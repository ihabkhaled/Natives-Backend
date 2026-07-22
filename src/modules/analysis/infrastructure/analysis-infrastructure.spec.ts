import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  ClipPlayContext,
  ClipStatus,
  ClipType,
  ClipVisibility,
  VideoAccessPolicy,
  VideoProcessingStatus,
  VideoProvider,
} from '../model/analysis.enums';
import type { VideoClipRow, VideoSourceRow } from '../model/analysis.rows';
import { AnalysisScopeRepository } from './analysis-scope.repository';
import { ClipDetailRepository } from './clip-detail.repository';
import { VideoClipRepository } from './video-clip.repository';
import { VideoSourceRepository } from './video-source.repository';

const NOW = new Date('2025-03-01T12:00:00.000Z');

const SOURCE_ROW: VideoSourceRow = {
  id: 'source-1',
  team_id: 'team-1',
  season_id: 'season-1',
  match_id: null,
  provider: 'youtube',
  external_ref: 'abc',
  title: 'Match',
  duration_seconds: null,
  sync_offset_seconds: 0,
  processing_status: 'pending',
  access_policy: 'coaches',
  record_version: 1,
  registered_by: 'user-1',
  created_at: NOW,
  updated_at: NOW,
};

const CLIP_ROW: VideoClipRow = {
  id: 'clip-1',
  team_id: 'team-1',
  season_id: 'season-1',
  source_id: 'source-1',
  match_id: null,
  point_id: null,
  event_id: null,
  start_second: 10,
  end_second: 20,
  play_context: 'offense',
  clip_type: 'do',
  title: 'Cut',
  comment: null,
  visibility: 'coach_only',
  status: 'draft',
  revision: 1,
  supersedes_clip_id: null,
  import_reference: null,
  record_version: 1,
  author_user_id: 'user-1',
  reviewed_by: null,
  reviewed_at: null,
  published_by: null,
  published_at: null,
  archived_at: null,
  created_at: NOW,
  updated_at: NOW,
};

function scopeReturning(...results: unknown[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  run.mockResolvedValue([]);
  return { scope: { run }, run };
}

describe('AnalysisScopeRepository', () => {
  const repository = new AnalysisScopeRepository();

  it('resolves the team’s newest live season', async () => {
    const { scope, run } = scopeReturning([{ season_id: 'season-1' }]);
    expect(await repository.resolveCurrentSeason(scope, 'team-1')).toBe(
      'season-1',
    );
    expect(String(run.mock.calls[0]?.[0])).toContain('ORDER BY');
  });

  it('hides a foreign match as an unresolved scope', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await repository.resolveMatchSeason(scope, 'team-1', 'match-9'),
    ).toBeNull();
  });

  it('resolves the season of a match inside the team', async () => {
    const { scope } = scopeReturning([{ season_id: 'season-2' }]);
    expect(
      await repository.resolveMatchSeason(scope, 'team-1', 'match-1'),
    ).toBe('season-2');
  });

  it('probes an active team', async () => {
    const present = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(present.scope, 'team-1')).toBe(
      true,
    );
    const absent = scopeReturning([]);
    expect(await repository.activeTeamExists(absent.scope, 'team-2')).toBe(
      false,
    );
  });

  it('lists the caller’s own memberships', async () => {
    const { scope } = scopeReturning([{ membership_id: 'member-1' }]);
    expect(
      await repository.listViewerMemberships(scope, 'team-1', 'user-1'),
    ).toEqual(['member-1']);
  });

  it('filters tagged ids down to real team memberships', async () => {
    const { scope, run } = scopeReturning([{ membership_id: 'member-1' }]);
    expect(
      await repository.filterTeamMemberships(scope, 'team-1', [
        'member-1',
        'member-9',
      ]),
    ).toEqual(['member-1']);
    expect(run).toHaveBeenCalledTimes(1);
    const empty = scopeReturning();
    expect(
      await repository.filterTeamMemberships(empty.scope, 'team-1', []),
    ).toEqual([]);
    expect(empty.run).not.toHaveBeenCalled();
  });

  it('refuses to resolve an ambiguous alias', async () => {
    const single = scopeReturning([{ membership_id: 'member-1' }]);
    expect(
      await repository.resolveAliasMembership(single.scope, 'team-1', 'Ahmed'),
    ).toBe('member-1');
    const ambiguous = scopeReturning([
      { membership_id: 'member-1' },
      { membership_id: 'member-2' },
    ]);
    expect(
      await repository.resolveAliasMembership(
        ambiguous.scope,
        'team-1',
        'Ahmed',
      ),
    ).toBeNull();
  });
});

describe('VideoSourceRepository', () => {
  const repository = new VideoSourceRepository();

  it('inserts a source and returns the persisted record', async () => {
    const { scope, run } = scopeReturning([SOURCE_ROW]);
    const source = await repository.insert(scope, {
      id: 'source-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      matchId: null,
      provider: VideoProvider.YouTube,
      externalRef: 'abc',
      title: 'Match',
      durationSeconds: null,
      syncOffsetSeconds: 0,
      processingStatus: VideoProcessingStatus.Pending,
      accessPolicy: VideoAccessPolicy.Coaches,
      registeredBy: 'user-1',
      now: NOW,
    });
    expect(source.sourceId).toBe('source-1');
    expect(String(run.mock.calls[0]?.[0])).not.toContain('SELECT *');
  });

  it('throws when a write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(
      repository.insert(scope, {
        id: 'source-1',
        teamId: 'team-1',
        seasonId: 'season-1',
        matchId: null,
        provider: VideoProvider.YouTube,
        externalRef: 'abc',
        title: 'Match',
        durationSeconds: null,
        syncOffsetSeconds: 0,
        processingStatus: VideoProcessingStatus.Pending,
        accessPolicy: VideoAccessPolicy.Coaches,
        registeredBy: 'user-1',
        now: NOW,
      }),
    ).rejects.toThrow(/video source write/u);
  });

  it('hides a cross-team source as not found', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await repository.findForWrite(scope, 'team-1', 'source-9'),
    ).toBeNull();
  });

  it('resolves a team-owned source', async () => {
    const { scope } = scopeReturning([SOURCE_ROW]);
    expect(
      (await repository.findForWrite(scope, 'team-1', 'source-1'))?.sourceId,
    ).toBe('source-1');
  });

  it('bounds the list and counts with the same filter', async () => {
    const list = scopeReturning([SOURCE_ROW]);
    expect(
      await repository.listForScope(
        list.scope,
        'team-1',
        { matchId: null, provider: null },
        { limit: 500, offset: 0 },
      ),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: '3' }]);
    expect(
      await repository.countForScope(count.scope, 'team-1', {
        matchId: null,
        provider: null,
      }),
    ).toBe(3);
    const empty = scopeReturning([]);
    expect(
      await repository.countForScope(empty.scope, 'team-1', {
        matchId: null,
        provider: null,
      }),
    ).toBe(0);
  });
});

describe('VideoClipRepository', () => {
  const repository = new VideoClipRepository();
  const newClip = {
    id: 'clip-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    sourceId: 'source-1',
    matchId: null,
    pointId: null,
    eventId: null,
    startSecond: 10,
    endSecond: 20,
    playContext: ClipPlayContext.Offense,
    clipType: ClipType.Do,
    title: 'Cut',
    comment: null,
    visibility: ClipVisibility.CoachOnly,
    revision: 1,
    supersedesClipId: null,
    importReference: null,
    authorUserId: 'user-1',
    now: NOW,
  };

  it('inserts a clip as a draft', async () => {
    const { scope, run } = scopeReturning([CLIP_ROW]);
    expect((await repository.insert(scope, newClip)).status).toBe(
      ClipStatus.Draft,
    );
    expect(String(run.mock.calls[0]?.[0])).toContain(`'draft'`);
  });

  it('throws when a clip write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newClip)).rejects.toThrow(
      /video clip write/u,
    );
  });

  it('resolves and hides clips by team ownership', async () => {
    const found = scopeReturning([CLIP_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'clip-1'))?.clipId,
    ).toBe('clip-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findForWrite(missing.scope, 'team-1', 'clip-9'),
    ).toBeNull();
  });

  it('finds a previously imported clip by its audited reference', async () => {
    const found = scopeReturning([CLIP_ROW]);
    expect(
      (await repository.findByImportReference(found.scope, 'team-1', 'row-1'))
        ?.clipId,
    ).toBe('clip-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findByImportReference(missing.scope, 'team-1', 'row-9'),
    ).toBeNull();
  });

  it('guards a status change with the expected record version', async () => {
    const change = {
      id: 'clip-1',
      teamId: 'team-1',
      expectedRecordVersion: 1,
      toStatus: ClipStatus.Published,
      reviewedBy: null,
      reviewedAt: null,
      publishedBy: 'user-1',
      publishedAt: NOW,
      archivedAt: null,
      now: NOW,
    };
    const applied = scopeReturning([{ ...CLIP_ROW, status: 'published' }]);
    expect(
      (await repository.applyStatusChange(applied.scope, change))?.status,
    ).toBe(ClipStatus.Published);
    expect(String(applied.run.mock.calls[0]?.[0])).toContain('record_version');
    const stale = scopeReturning([]);
    expect(await repository.applyStatusChange(stale.scope, change)).toBeNull();
  });

  it('bounds the queue read and counts with the same predicate', async () => {
    const filter = {
      sourceId: null,
      matchId: null,
      clipType: null,
      status: null,
      membershipId: 'member-1',
      tag: 'zone',
    };
    const list = scopeReturning([CLIP_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 5,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    expect(String(list.run.mock.calls[0]?.[0])).toContain('video_clip_tags');
    const count = scopeReturning([{ count: 2 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      2,
    );
    const empty = scopeReturning([]);
    expect(await repository.countForScope(empty.scope, 'team-1', filter)).toBe(
      0,
    );
  });
});

describe('ClipDetailRepository', () => {
  const repository = new ClipDetailRepository();

  it('replaces the tagged players, skipping the insert when empty', async () => {
    const withPlayers = scopeReturning([], []);
    await repository.replacePlayers(
      withPlayers.scope,
      'clip-1',
      ['member-1'],
      NOW,
    );
    expect(withPlayers.run).toHaveBeenCalledTimes(2);
    const none = scopeReturning([]);
    await repository.replacePlayers(none.scope, 'clip-1', [], NOW);
    expect(none.run).toHaveBeenCalledTimes(1);
  });

  it('replaces tags, skipping the insert when empty', async () => {
    const withTags = scopeReturning([], []);
    await repository.replaceTags(withTags.scope, 'clip-1', ['zone'], NOW);
    expect(withTags.run).toHaveBeenCalledTimes(2);
    const none = scopeReturning([]);
    await repository.replaceTags(none.scope, 'clip-1', [], NOW);
    expect(none.run).toHaveBeenCalledTimes(1);
  });

  it('reads satellites in one bounded query and short-circuits on no ids', async () => {
    const players = scopeReturning([
      {
        id: 'p-1',
        clip_id: 'clip-1',
        membership_id: 'member-1',
        acknowledged_at: null,
        created_at: NOW,
      },
    ]);
    expect(
      await repository.listPlayers(players.scope, ['clip-1']),
    ).toHaveLength(1);
    const tags = scopeReturning([{ clip_id: 'clip-1', tag: 'zone' }]);
    expect(await repository.listTags(tags.scope, ['clip-1'])).toHaveLength(1);
    const empty = scopeReturning();
    expect(await repository.listPlayers(empty.scope, [])).toEqual([]);
    expect(await repository.listTags(empty.scope, [])).toEqual([]);
    expect(empty.run).not.toHaveBeenCalled();
  });

  it('stamps an acknowledgement once and never rewrites it', async () => {
    const first = scopeReturning([
      {
        id: 'p-1',
        clip_id: 'clip-1',
        membership_id: 'member-1',
        acknowledged_at: NOW,
        created_at: NOW,
      },
    ]);
    expect(
      await repository.acknowledge(first.scope, 'clip-1', 'member-1', NOW),
    ).toBe(true);
    expect(String(first.run.mock.calls[0]?.[0])).toContain(
      '"acknowledged_at" IS NULL',
    );
    const replay = scopeReturning([]);
    expect(
      await repository.acknowledge(replay.scope, 'clip-1', 'member-1', NOW),
    ).toBe(false);
  });
});
