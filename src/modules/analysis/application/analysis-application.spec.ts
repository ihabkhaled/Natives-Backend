import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisScopeNotFoundError } from '../errors/analysis-scope-not-found.error';
import { ClipImmutableError } from '../errors/clip-immutable.error';
import { ClipInvalidTransitionError } from '../errors/clip-invalid-transition.error';
import { ClipNotVisibleError } from '../errors/clip-not-visible.error';
import { ClipTimestampError } from '../errors/clip-timestamp.error';
import { ClipVersionConflictError } from '../errors/clip-version-conflict.error';
import { VideoAccessDeniedError } from '../errors/video-access-denied.error';
import { VideoClipNotFoundError } from '../errors/video-clip-not-found.error';
import { VideoSourceNotFoundError } from '../errors/video-source-not-found.error';
import type { AnalysisScopeRepository } from '../infrastructure/analysis-scope.repository';
import type { ClipDetailRepository } from '../infrastructure/clip-detail.repository';
import type { VideoClipRepository } from '../infrastructure/video-clip.repository';
import type { VideoSourceRepository } from '../infrastructure/video-source.repository';
import {
  ClipImportOutcome,
  ClipPlayContext,
  ClipStatus,
  ClipTransition,
  ClipType,
  ClipVisibility,
  VideoAccessPolicy,
  VideoProcessingStatus,
  VideoProvider,
} from '../model/analysis.enums';
import type {
  VideoAccessPort,
  VideoClip,
  VideoClipContent,
  VideoSource,
} from '../model/analysis.types';
import { AcknowledgeVideoClipUseCase } from './acknowledge-video-clip.use-case';
import { AnalysisAuthorityService } from './analysis-authority.service';
import { AnalysisLookupService } from './analysis-lookup.service';
import { AnalysisScopeService } from './analysis-scope.service';
import { ClipViewService } from './clip-view.service';
import { CreateVideoClipUseCase } from './create-video-clip.use-case';
import { ImportVideoClipsUseCase } from './import-video-clips.use-case';
import { RegisterVideoSourceUseCase } from './register-video-source.use-case';
import { ReviseVideoClipUseCase } from './revise-video-clip.use-case';
import { TransitionVideoClipUseCase } from './transition-video-clip.use-case';
import { VideoAccessService } from './video-access.service';
import { VideoClipQueryService } from './video-clip-query.service';
import { VideoSourceQueryService } from './video-source-query.service';

const NOW = new Date('2025-03-01T12:00:00.000Z');
const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const CLOCK: ClockPort = { now: () => NOW, uptime: () => 0 };
const IDS: IdGeneratorPort = { generate: () => 'generated-id' };
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'coach@example.test',
  roles: [],
};

function auditStub(): AuditRecorderService {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorderService;
}

function eventsStub(): RecordDomainEventService {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as RecordDomainEventService;
}

const SOURCE: VideoSource = {
  sourceId: 'source-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  matchId: 'match-1',
  provider: VideoProvider.YouTube,
  externalRef: 'abc',
  title: 'Match',
  durationSeconds: 600,
  syncOffsetSeconds: 0,
  processingStatus: VideoProcessingStatus.Ready,
  accessPolicy: VideoAccessPolicy.Coaches,
  recordVersion: 1,
  registeredBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const CLIP: VideoClip = {
  clipId: 'clip-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  sourceId: 'source-1',
  matchId: 'match-1',
  pointId: null,
  eventId: null,
  startSecond: 10,
  endSecond: 20,
  playContext: ClipPlayContext.Offense,
  clipType: ClipType.Do,
  title: 'Cut',
  comment: 'note',
  visibility: ClipVisibility.TaggedPlayers,
  status: ClipStatus.Draft,
  revision: 1,
  supersedesClipId: null,
  importReference: null,
  recordVersion: 1,
  authorUserId: 'user-1',
  reviewedBy: null,
  reviewedAt: null,
  publishedBy: null,
  publishedAt: null,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const CONTENT: VideoClipContent = {
  sourceId: 'source-1',
  pointId: null,
  eventId: null,
  startSecond: 10,
  endSecond: 20,
  playContext: ClipPlayContext.Offense,
  clipType: ClipType.Do,
  title: 'Cut',
  comment: 'note',
  visibility: ClipVisibility.TaggedPlayers,
  membershipIds: ['member-1'],
  tags: ['zone'],
};

function scopeRepo(
  overrides: Record<string, unknown> = {},
): AnalysisScopeRepository {
  return {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    resolveCurrentSeason: vi.fn().mockResolvedValue('season-1'),
    resolveMatchSeason: vi.fn().mockResolvedValue('season-1'),
    listViewerMemberships: vi.fn().mockResolvedValue(['member-1']),
    filterTeamMemberships: vi.fn().mockResolvedValue(['member-1']),
    resolveAliasMembership: vi.fn().mockResolvedValue('member-1'),
    ...overrides,
  };
}

function detailRepo(): ClipDetailRepository {
  return {
    replacePlayers: vi.fn().mockResolvedValue(undefined),
    replaceTags: vi.fn().mockResolvedValue(undefined),
    listPlayers: vi.fn().mockResolvedValue([
      {
        id: 'p-1',
        clip_id: 'clip-1',
        membership_id: 'member-1',
        acknowledged_at: null,
        created_at: NOW,
      },
    ]),
    listTags: vi.fn().mockResolvedValue([{ clip_id: 'clip-1', tag: 'zone' }]),
    acknowledge: vi.fn().mockResolvedValue(true),
  };
}

function sourceRepo(
  source: VideoSource | null = SOURCE,
): VideoSourceRepository {
  return {
    insert: vi.fn().mockResolvedValue(SOURCE),
    findForWrite: vi.fn().mockResolvedValue(source),
    listForScope: vi.fn().mockResolvedValue([SOURCE]),
    countForScope: vi.fn().mockResolvedValue(1),
  } as unknown as VideoSourceRepository;
}

function clipRepo(
  overrides: Record<string, unknown> = {},
): VideoClipRepository {
  return {
    insert: vi.fn().mockResolvedValue(CLIP),
    findForWrite: vi.fn().mockResolvedValue(CLIP),
    findByImportReference: vi.fn().mockResolvedValue(null),
    applyStatusChange: vi.fn().mockResolvedValue(CLIP),
    listForScope: vi.fn().mockResolvedValue([CLIP]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as VideoClipRepository;
}

function authority(team: boolean, manage = team): AnalysisAuthorityService {
  return new AnalysisAuthorityService({
    resolve: vi
      .fn()
      .mockResolvedValue(
        new Set([
          ...(team ? ['match.analysis.read.team'] : []),
          ...(manage ? ['match.analysis.manage'] : []),
        ]),
      ),
  });
}

describe('AnalysisAuthorityService', () => {
  it('resolves the analyst and manager tiers from effective permissions', async () => {
    const service = authority(true);
    expect(await service.canReadTeamAnalysis(ACTOR, 'team-1')).toBe(true);
    expect(await service.canManageAnalysis(ACTOR, 'team-1')).toBe(true);
    const player = authority(false, false);
    expect(await player.canReadTeamAnalysis(ACTOR, 'team-1')).toBe(false);
    expect(await player.canManageAnalysis(ACTOR, 'team-1')).toBe(false);
  });
});

describe('AnalysisScopeService', () => {
  it('resolves the current season when no match is referenced', async () => {
    const service = new AnalysisScopeService(scopeRepo());
    expect(await service.forMatch(TX, 'team-1', null)).toEqual({
      teamId: 'team-1',
      seasonId: 'season-1',
    });
  });

  it('hides an archived team and an unresolvable match as not found', async () => {
    const inactive = new AnalysisScopeService(
      scopeRepo({ activeTeamExists: vi.fn().mockResolvedValue(false) }),
    );
    await expect(inactive.forMatch(TX, 'team-1', null)).rejects.toBeInstanceOf(
      AnalysisScopeNotFoundError,
    );
    const missing = new AnalysisScopeService(
      scopeRepo({ resolveMatchSeason: vi.fn().mockResolvedValue(null) }),
    );
    await expect(
      missing.forMatch(TX, 'team-1', 'match-9'),
    ).rejects.toBeInstanceOf(AnalysisScopeNotFoundError);
  });

  it('delegates membership and alias resolution', async () => {
    const service = new AnalysisScopeService(scopeRepo());
    expect(await service.listViewerMemberships(TX, 'team-1', 'user-1')).toEqual(
      ['member-1'],
    );
    expect(
      await service.filterTeamMemberships(TX, 'team-1', ['member-1']),
    ).toEqual(['member-1']);
    expect(await service.resolveAliasMembership(TX, 'team-1', 'Ahmed')).toBe(
      'member-1',
    );
  });
});

describe('AnalysisLookupService', () => {
  it('translates a miss into a not-found that hides existence', async () => {
    const lookup = new AnalysisLookupService(
      sourceRepo(null),
      clipRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
    );
    await expect(
      lookup.requireSource(TX, 'team-1', 'source-9'),
    ).rejects.toBeInstanceOf(VideoSourceNotFoundError);
    await expect(
      lookup.requireClip(TX, 'team-1', 'clip-9'),
    ).rejects.toBeInstanceOf(VideoClipNotFoundError);
  });

  it('resolves a team-owned source and clip', async () => {
    const lookup = new AnalysisLookupService(sourceRepo(), clipRepo());
    expect(
      (await lookup.requireSource(TX, 'team-1', 'source-1')).sourceId,
    ).toBe('source-1');
    expect((await lookup.requireClip(TX, 'team-1', 'clip-1')).clipId).toBe(
      'clip-1',
    );
  });
});

describe('ClipViewService', () => {
  it('assembles tags, players, and acknowledgements in two queries', async () => {
    const details = detailRepo();
    const service = new ClipViewService(details);
    const views = await service.assemble(TX, [CLIP]);
    expect(views[0]?.tags).toEqual(['zone']);
    expect(views[0]?.membershipIds).toEqual(['member-1']);
    expect(views[0]?.acknowledgedMembershipIds).toEqual([]);
    expect(details.listPlayers).toHaveBeenCalledTimes(1);
  });

  it('falls back to an empty view when the page returns nothing', async () => {
    const details = {
      listPlayers: vi.fn().mockResolvedValue([]),
      listTags: vi.fn().mockResolvedValue([]),
    } as unknown as ClipDetailRepository;
    const view = await new ClipViewService(details).assembleOne(TX, CLIP);
    expect(view.membershipIds).toEqual([]);
  });
});

describe('VideoSourceQueryService', () => {
  it('returns a bounded page echoing the requested window', async () => {
    const service = new VideoSourceQueryService(
      UOW,
      sourceRepo(),
      new AnalysisLookupService(sourceRepo(), clipRepo()),
    );
    expect(
      await service.listForScope(
        'team-1',
        { matchId: null, provider: null },
        { limit: 20, offset: 0 },
      ),
    ).toEqual({ items: [SOURCE], total: 1, limit: 20, offset: 0 });
    expect((await service.getById('team-1', 'source-1')).sourceId).toBe(
      'source-1',
    );
  });
});

describe('VideoClipQueryService', () => {
  function build(analyst: boolean): VideoClipQueryService {
    return new VideoClipQueryService(
      UOW,
      clipRepo(),
      new AnalysisLookupService(sourceRepo(), clipRepo()),
      new ClipViewService(detailRepo()),
      new AnalysisScopeService(scopeRepo()),
      authority(analyst),
    );
  }

  it('gives an analyst the full clip including the coaching note', async () => {
    const page = await build(true).listForScope(
      ACTOR,
      'team-1',
      {
        sourceId: null,
        matchId: null,
        clipType: null,
        status: null,
        membershipId: null,
        tag: null,
      },
      { limit: 20, offset: 0 },
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.clip.comment).toBe('note');
  });

  it('hides an unpublished clip from a player entirely', async () => {
    const page = await build(false).listForScope(
      ACTOR,
      'team-1',
      {
        sourceId: null,
        matchId: null,
        clipType: null,
        status: null,
        membershipId: null,
        tag: null,
      },
      { limit: 20, offset: 0 },
    );
    expect(page.items).toEqual([]);
    expect(page.total).toBe(1);
  });

  it('refuses direct access to a clip the caller may not see', async () => {
    await expect(
      build(false).getById(ACTOR, 'team-1', 'clip-1'),
    ).rejects.toBeInstanceOf(ClipNotVisibleError);
  });

  it('returns a visible published clip to its tagged player', async () => {
    const published = { ...CLIP, status: ClipStatus.Published };
    const service = new VideoClipQueryService(
      UOW,
      clipRepo({ findForWrite: vi.fn().mockResolvedValue(published) }),
      new AnalysisLookupService(
        sourceRepo(),
        clipRepo({ findForWrite: vi.fn().mockResolvedValue(published) }),
      ),
      new ClipViewService(detailRepo()),
      new AnalysisScopeService(scopeRepo()),
      authority(false),
    );
    const view = await service.getById(ACTOR, 'team-1', 'clip-1');
    expect(view.clip.comment).toBe('note');
  });
});

describe('VideoAccessService', () => {
  const access: VideoAccessPort = {
    createAccessTicket: () => ({
      url: 'https://provider.example/video',
      expiresAt: NOW,
    }),
  };

  function build(
    policy: VideoAccessPolicy,
    analyst: boolean,
    manager = analyst,
  ) {
    return new VideoAccessService(
      UOW,
      CLOCK,
      access,
      new AnalysisLookupService(
        sourceRepo({ ...SOURCE, accessPolicy: policy }),
        clipRepo(),
      ),
      authority(analyst, manager),
      auditStub(),
    );
  }

  it('hands a team-visible recording to any authenticated member', async () => {
    const grant = await build(VideoAccessPolicy.Team, false, false).grant(
      ACTOR,
      'team-1',
      'source-1',
    );
    expect(grant.url).toContain('https://');
    expect(grant.expiresAt).toBe(NOW);
  });

  it('refuses a coaches-only recording to a plain player', async () => {
    await expect(
      build(VideoAccessPolicy.Coaches, false, false).grant(
        ACTOR,
        'team-1',
        'source-1',
      ),
    ).rejects.toBeInstanceOf(VideoAccessDeniedError);
  });

  it('refuses a restricted recording to an analyst without manage', async () => {
    await expect(
      build(VideoAccessPolicy.Restricted, true, false).grant(
        ACTOR,
        'team-1',
        'source-1',
      ),
    ).rejects.toBeInstanceOf(VideoAccessDeniedError);
    const grant = await build(VideoAccessPolicy.Restricted, true, true).grant(
      ACTOR,
      'team-1',
      'source-1',
    );
    expect(grant.sourceId).toBe('source-1');
  });
});

describe('RegisterVideoSourceUseCase', () => {
  it('resolves the scope server-side and audits the registration', async () => {
    const audit = auditStub();
    const sources = sourceRepo();
    const useCase = new RegisterVideoSourceUseCase(
      UOW,
      CLOCK,
      IDS,
      new AnalysisScopeService(scopeRepo()),
      sources,
      audit,
    );
    const source = await useCase.execute(ACTOR, 'team-1', {
      content: {
        matchId: 'match-1',
        provider: VideoProvider.YouTube,
        externalRef: 'abc',
        title: 'Match',
        durationSeconds: null,
        syncOffsetSeconds: 0,
        processingStatus: VideoProcessingStatus.Pending,
        accessPolicy: VideoAccessPolicy.Coaches,
      },
    });
    expect(source.sourceId).toBe('source-1');
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});

describe('CreateVideoClipUseCase', () => {
  function build(source: VideoSource) {
    const details = detailRepo();
    return {
      details,
      useCase: new CreateVideoClipUseCase(
        UOW,
        CLOCK,
        IDS,
        new AnalysisLookupService(sourceRepo(source), clipRepo()),
        new AnalysisScopeService(scopeRepo()),
        clipRepo(),
        details,
        new ClipViewService(details),
        auditStub(),
      ),
    };
  }

  it('creates a draft and writes its players and tags', async () => {
    const { useCase, details } = build(SOURCE);
    const view = await useCase.execute(ACTOR, 'team-1', { content: CONTENT });
    expect(view.clip.clipId).toBe('clip-1');
    expect(details.replacePlayers).toHaveBeenCalledWith(
      TX,
      'clip-1',
      ['member-1'],
      NOW,
    );
  });

  it('rejects a window past a known duration', async () => {
    const { useCase } = build({ ...SOURCE, durationSeconds: 15 });
    await expect(
      useCase.execute(ACTOR, 'team-1', { content: CONTENT }),
    ).rejects.toBeInstanceOf(ClipTimestampError);
  });

  it('accepts the same window when the duration is unknown', async () => {
    const { useCase } = build({ ...SOURCE, durationSeconds: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', { content: CONTENT }),
    ).resolves.toBeDefined();
  });
});

describe('TransitionVideoClipUseCase', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const clips = clipRepo(overrides);
    const events = eventsStub();
    return {
      events,
      useCase: new TransitionVideoClipUseCase(
        UOW,
        CLOCK,
        new AnalysisLookupService(sourceRepo(), clips),
        clips,
        new ClipViewService(detailRepo()),
        auditStub(),
        events,
      ),
    };
  }

  it('publishes and enqueues the audience size only', async () => {
    const published = { ...CLIP, status: ClipStatus.Published };
    const { useCase, events } = build({
      applyStatusChange: vi.fn().mockResolvedValue(published),
    });
    const view = await useCase.execute(ACTOR, 'team-1', 'clip-1', {
      transition: ClipTransition.Publish,
      expectedRecordVersion: 1,
    });
    expect(view.clip.status).toBe(ClipStatus.Published);
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('refuses an illegal transition', async () => {
    const { useCase } = build({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CLIP, status: ClipStatus.Archived }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'clip-1', {
        transition: ClipTransition.Publish,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ClipInvalidTransitionError);
  });

  it('reports a concurrent modification as a version conflict', async () => {
    const { useCase } = build({
      applyStatusChange: vi.fn().mockResolvedValue(null),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'clip-1', {
        transition: ClipTransition.Submit,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ClipVersionConflictError);
  });

  it('does not enqueue a publish event for a review transition', async () => {
    const { useCase, events } = build({
      applyStatusChange: vi
        .fn()
        .mockResolvedValue({ ...CLIP, status: ClipStatus.InReview }),
    });
    await useCase.execute(ACTOR, 'team-1', 'clip-1', {
      transition: ClipTransition.Submit,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue).not.toHaveBeenCalled();
  });
});

describe('ReviseVideoClipUseCase', () => {
  function build(overrides: Record<string, unknown> = {}, source = SOURCE) {
    const clips = clipRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CLIP, status: ClipStatus.Published }),
      applyStatusChange: vi
        .fn()
        .mockResolvedValue({ ...CLIP, status: ClipStatus.Revised }),
      ...overrides,
    });
    const events = eventsStub();
    return {
      events,
      clips,
      useCase: new ReviseVideoClipUseCase(
        UOW,
        CLOCK,
        IDS,
        new AnalysisLookupService(sourceRepo(source), clips),
        new AnalysisScopeService(scopeRepo()),
        clips,
        detailRepo(),
        new ClipViewService(detailRepo()),
        auditStub(),
        events,
      ),
    };
  }

  const command = {
    content: CONTENT,
    reason: 'wrong timestamp',
    expectedRecordVersion: 1,
  };

  it('supersedes a published clip with a successor revision', async () => {
    const { useCase, events, clips } = build();
    const view = await useCase.execute(ACTOR, 'team-1', 'clip-1', command);
    expect(view.clip.clipId).toBe('clip-1');
    expect(clips.insert).toHaveBeenCalledTimes(1);
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('refuses to revise a clip that was never published', async () => {
    const { useCase } = build({
      findForWrite: vi.fn().mockResolvedValue(CLIP),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'clip-1', command),
    ).rejects.toBeInstanceOf(ClipImmutableError);
  });

  it('re-checks the timestamp window of the successor', async () => {
    const { useCase } = build({}, { ...SOURCE, durationSeconds: 5 });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'clip-1', command),
    ).rejects.toBeInstanceOf(ClipTimestampError);
  });

  it('reports a lost race as a version conflict', async () => {
    const { useCase } = build({
      applyStatusChange: vi.fn().mockResolvedValue(null),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'clip-1', command),
    ).rejects.toBeInstanceOf(ClipVersionConflictError);
  });
});

describe('AcknowledgeVideoClipUseCase', () => {
  function build(clip: VideoClip) {
    const details = detailRepo();
    return {
      details,
      useCase: new AcknowledgeVideoClipUseCase(
        UOW,
        CLOCK,
        new AnalysisLookupService(
          sourceRepo(),
          clipRepo({ findForWrite: vi.fn().mockResolvedValue(clip) }),
        ),
        new AnalysisScopeService(scopeRepo()),
        details,
        new ClipViewService(details),
        auditStub(),
      ),
    };
  }

  it('records the acknowledgement of a tagged player', async () => {
    const { useCase, details } = build({
      ...CLIP,
      status: ClipStatus.Published,
    });
    await useCase.execute(ACTOR, 'team-1', 'clip-1');
    expect(details.acknowledge).toHaveBeenCalledWith(
      TX,
      'clip-1',
      'member-1',
      NOW,
    );
  });

  it('refuses when the clip is not addressed to the caller', async () => {
    const { useCase } = build({ ...CLIP, status: ClipStatus.Draft });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'clip-1'),
    ).rejects.toBeInstanceOf(ClipNotVisibleError);
  });
});

describe('ImportVideoClipsUseCase', () => {
  function build(overrides: Record<string, unknown> = {}, scope = scopeRepo()) {
    const clips = clipRepo(overrides);
    return {
      clips,
      useCase: new ImportVideoClipsUseCase(
        UOW,
        CLOCK,
        IDS,
        new AnalysisLookupService(sourceRepo(), clips),
        new AnalysisScopeService(scope),
        clips,
        detailRepo(),
        auditStub(),
      ),
    };
  }

  const row = {
    reference: 'row-1',
    sourceId: 'source-1',
    startSecond: 10,
    endSecond: 20,
    clipType: ClipType.Do,
    playContext: ClipPlayContext.Offense,
    title: 'Cut',
    comment: null,
    playerAliases: ['Ahmed'],
    tags: ['zone'],
  };

  it('writes nothing on a dry run but reports the outcome', async () => {
    const { useCase, clips } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: true,
      rows: [row],
    });
    expect(report.imported).toBe(1);
    expect(report.rows[0]?.clipId).toBeNull();
    expect(clips.insert).not.toHaveBeenCalled();
  });

  it('imports a row and reports the created clip', async () => {
    const { useCase, clips } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: false,
      rows: [row],
    });
    expect(report.imported).toBe(1);
    expect(clips.insert).toHaveBeenCalledTimes(1);
  });

  it('reports a replayed reference as a duplicate instead of writing twice', async () => {
    const { useCase, clips } = build({
      findByImportReference: vi.fn().mockResolvedValue(CLIP),
    });
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: false,
      rows: [row],
    });
    expect(report.skippedDuplicate).toBe(1);
    expect(clips.insert).not.toHaveBeenCalled();
  });

  it('rejects a timestamp beyond the recording rather than clamping it', async () => {
    const { useCase } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: false,
      rows: [{ ...row, startSecond: 5000, endSecond: 5100 }],
    });
    expect(report.rejectedTimestamp).toBe(1);
    expect(report.rows[0]?.outcome).toBe(ClipImportOutcome.RejectedTimestamp);
  });

  it('rejects a row whose alias does not resolve to exactly one member', async () => {
    const { useCase } = build(
      {},
      scopeRepo({ resolveAliasMembership: vi.fn().mockResolvedValue(null) }),
    );
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: false,
      rows: [row],
    });
    expect(report.rejectedAlias).toBe(1);
  });

  it('reports an empty run without auditing a scopeless import', async () => {
    const { useCase } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: true,
      rows: [],
    });
    expect(report.received).toBe(0);
  });
});
