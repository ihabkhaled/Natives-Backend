import { describe, expect, it } from 'vitest';

import {
  ClipImportOutcome,
  ClipPlayContext,
  ClipStatus,
  ClipType,
  ClipVisibility,
  VideoAccessPolicy,
  VideoProcessingStatus,
  VideoProvider,
} from '../model/analysis.enums';
import type {
  ClipPlayerRow,
  VideoClipRow,
  VideoSourceRow,
} from '../model/analysis.rows';
import type { VideoClip, VideoSource } from '../model/analysis.types';
import {
  buildAccessGrantedAudit,
  buildAcknowledgementAudit,
  buildClipAudit,
  buildClipPublishedEvent,
  buildClipRevisedEvent,
  buildClipStatusChange,
  buildImportAudit,
  buildImportedClip,
  buildNewVideoClip,
  buildNewVideoSource,
  buildSourceRegisteredAudit,
  buildSuccessorClip,
} from './analysis.builders';
import {
  normalizeTag,
  normalizeTags,
  parseEnumValue,
  resolveAnalysisPage,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
  uniqueIds,
} from './analysis.helpers';
import {
  toClipAcknowledgement,
  toVideoClip,
  toVideoSource,
} from './analysis.mapper';
import {
  toClipImportRow,
  toClipImportRows,
  toVideoClipContent,
  toVideoClipListFilter,
  toVideoSourceContent,
  toVideoSourceListFilter,
} from './analysis-command.mapper';
import {
  buildImportReport,
  buildRowResult,
  countOutcome,
  isBalancedReport,
} from './clip-import.reconciler';

const NOW = new Date('2025-03-01T12:00:00.000Z');

const SOURCE_ROW: VideoSourceRow = {
  id: 'source-1',
  team_id: 'team-1',
  season_id: 'season-1',
  match_id: 'match-1',
  provider: 'youtube',
  external_ref: 'abc123',
  title: 'Semi final',
  duration_seconds: '3600',
  sync_offset_seconds: '-12',
  processing_status: 'ready',
  access_policy: 'coaches',
  record_version: '2',
  registered_by: 'user-1',
  created_at: '2025-03-01T10:00:00.000Z',
  updated_at: new Date('2025-03-01T10:00:00.000Z'),
};

const CLIP_ROW: VideoClipRow = {
  id: 'clip-1',
  team_id: 'team-1',
  season_id: 'season-1',
  source_id: 'source-1',
  match_id: 'match-1',
  point_id: null,
  event_id: null,
  start_second: '120',
  end_second: null,
  play_context: 'defense',
  clip_type: 'dont',
  title: 'Late switch',
  comment: null,
  visibility: 'coach_only',
  status: 'draft',
  revision: '1',
  supersedes_clip_id: null,
  import_reference: null,
  record_version: '1',
  author_user_id: 'user-1',
  reviewed_by: null,
  reviewed_at: null,
  published_by: null,
  published_at: null,
  archived_at: null,
  created_at: '2025-03-01T10:05:00.000Z',
  updated_at: '2025-03-01T10:05:00.000Z',
};

const SOURCE: VideoSource = toVideoSource(SOURCE_ROW);
const CLIP: VideoClip = toVideoClip(CLIP_ROW);

const CONTENT = {
  sourceId: 'source-1',
  pointId: null,
  eventId: null,
  startSecond: 100,
  endSecond: 140,
  playContext: ClipPlayContext.Offense,
  clipType: ClipType.Do,
  title: 'Break mark',
  comment: 'note',
  visibility: ClipVisibility.TaggedPlayers,
  membershipIds: ['member-1'],
  tags: ['flow'],
};

describe('analysis helpers', () => {
  it('clamps paging to the bounded default window', () => {
    expect(resolveAnalysisPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveAnalysisPage(5000, 40)).toEqual({ limit: 100, offset: 40 });
  });

  it('coerces driver values without inventing zeros', () => {
    expect(toDate('2025-03-01T00:00:00.000Z')).toBeInstanceOf(Date);
    expect(toDate(NOW)).toBe(NOW);
    expect(toNullableDate(null)).toBeNull();
    expect(toNumber('42')).toBe(42);
    expect(toNumber(42)).toBe(42);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('7')).toBe(7);
  });

  it('rejects an unrecognized stored enum value', () => {
    expect(parseEnumValue(['a', 'b'], 'a', 'letter')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'letter')).toThrow(/letter/u);
  });

  it('normalizes, de-duplicates, and orders tags', () => {
    expect(normalizeTag('  Deep   Cut ')).toBe('deep cut');
    expect(normalizeTags(['Zone', 'zone', '  ', 'Flow'])).toEqual([
      'flow',
      'zone',
    ]);
  });

  it('de-duplicates ids deterministically', () => {
    expect(uniqueIds(['b', 'a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('analysis mapper', () => {
  it('maps a source row, preserving a null duration as unknown', () => {
    expect(SOURCE.durationSeconds).toBe(3600);
    expect(SOURCE.syncOffsetSeconds).toBe(-12);
    expect(SOURCE.provider).toBe(VideoProvider.YouTube);
    expect(SOURCE.processingStatus).toBe(VideoProcessingStatus.Ready);
    expect(SOURCE.accessPolicy).toBe(VideoAccessPolicy.Coaches);
    expect(
      toVideoSource({ ...SOURCE_ROW, duration_seconds: null }).durationSeconds,
    ).toBeNull();
  });

  it('maps a clip row with an open-ended window', () => {
    expect(CLIP.startSecond).toBe(120);
    expect(CLIP.endSecond).toBeNull();
    expect(CLIP.status).toBe(ClipStatus.Draft);
    expect(CLIP.visibility).toBe(ClipVisibility.CoachOnly);
  });

  it('treats a missing acknowledgement instant as not acknowledged', () => {
    const row: ClipPlayerRow = {
      id: 'p-1',
      clip_id: 'clip-1',
      membership_id: 'member-1',
      acknowledged_at: null,
      created_at: NOW,
    };
    expect(toClipAcknowledgement(row)).toBeNull();
    expect(toClipAcknowledgement({ ...row, acknowledged_at: NOW })).toEqual({
      clipId: 'clip-1',
      membershipId: 'member-1',
      acknowledgedAt: NOW,
    });
  });
});

describe('analysis command mapper', () => {
  it('defaults an absent source field without coercing unknown to zero', () => {
    const content = toVideoSourceContent({
      provider: VideoProvider.Vimeo,
      externalRef: '  ref  ',
      title: ' Final ',
    });
    expect(content).toEqual({
      matchId: null,
      provider: VideoProvider.Vimeo,
      externalRef: 'ref',
      title: 'Final',
      durationSeconds: null,
      syncOffsetSeconds: 0,
      processingStatus: VideoProcessingStatus.Pending,
      accessPolicy: VideoAccessPolicy.Coaches,
    });
  });

  it('defaults clip content to the safest visibility', () => {
    const content = toVideoClipContent({
      sourceId: 'source-1',
      startSecond: 10,
      clipType: ClipType.Note,
      title: ' Mark ',
    });
    expect(content.visibility).toBe(ClipVisibility.CoachOnly);
    expect(content.playContext).toBe(ClipPlayContext.Unspecified);
    expect(content.endSecond).toBeNull();
    expect(content.membershipIds).toEqual([]);
    expect(content.tags).toEqual([]);
  });

  it('keeps every absent list facet null', () => {
    expect(toVideoSourceListFilter({})).toEqual({
      matchId: null,
      provider: null,
    });
    expect(toVideoClipListFilter({})).toEqual({
      sourceId: null,
      matchId: null,
      clipType: null,
      status: null,
      membershipId: null,
      tag: null,
    });
    expect(toVideoClipListFilter({ tag: ' Zone ' }).tag).toBe('zone');
  });

  it('normalizes an import row and keeps alias spelling', () => {
    const row = toClipImportRow({
      reference: ' row-1 ',
      sourceId: 'source-1',
      startSecond: 10,
      clipType: ClipType.GoodExample,
      title: ' Great cut ',
      playerAliases: [' Ahmed  '],
    });
    expect(row.reference).toBe('row-1');
    expect(row.playerAliases).toEqual(['Ahmed']);
    expect(row.endSecond).toBeNull();
    expect(toClipImportRows([])).toEqual([]);
  });
});

describe('analysis builders', () => {
  it('builds a new source and clip from resolved scope', () => {
    const source = buildNewVideoSource(
      'id-1',
      'team-1',
      'season-1',
      toVideoSourceContent({
        provider: VideoProvider.Drive,
        externalRef: 'ref',
        title: 'Match',
      }),
      'user-1',
      NOW,
    );
    expect(source.seasonId).toBe('season-1');
    const clip = buildNewVideoClip('clip-9', SOURCE, CONTENT, 'user-1', NOW);
    expect(clip.revision).toBe(1);
    expect(clip.supersedesClipId).toBeNull();
    expect(clip.importReference).toBeNull();
  });

  it('builds a successor revision pointing back at the superseded clip', () => {
    const successor = buildSuccessorClip(
      'clip-2',
      { ...CLIP, revision: 3 },
      CONTENT,
      'user-2',
      NOW,
    );
    expect(successor.revision).toBe(4);
    expect(successor.supersedesClipId).toBe('clip-1');
  });

  it('stamps an imported clip with its audited reference', () => {
    expect(
      buildImportedClip('clip-3', SOURCE, CONTENT, 'row-1', 'user-1', NOW)
        .importReference,
    ).toBe('row-1');
  });

  it('stamps only the instants a transition owns', () => {
    const published = buildClipStatusChange(
      CLIP,
      ClipStatus.Published,
      'user-1',
      1,
      NOW,
    );
    expect(published.publishedAt).toBe(NOW);
    expect(published.archivedAt).toBeNull();
    const reviewed = buildClipStatusChange(
      CLIP,
      ClipStatus.InReview,
      'user-1',
      1,
      NOW,
    );
    expect(reviewed.reviewedAt).toBe(NOW);
    expect(reviewed.publishedAt).toBeNull();
    const archived = buildClipStatusChange(
      CLIP,
      ClipStatus.Archived,
      'user-1',
      1,
      NOW,
    );
    expect(archived.archivedAt).toBe(NOW);
  });

  it('audits without ever carrying the note body', () => {
    const audit = buildClipAudit('analysis.clip.created', 'user-1', CLIP);
    expect(JSON.stringify(audit.diff)).not.toContain('Late switch');
    expect(buildSourceRegisteredAudit('user-1', SOURCE).resourceId).toBe(
      'source-1',
    );
    expect(buildAccessGrantedAudit('user-1', SOURCE).action).toContain(
      'access_granted',
    );
    expect(
      buildAcknowledgementAudit('user-1', CLIP, 'member-1').diff[
        'membershipId'
      ],
    ).toBe('member-1');
  });

  it('publishes only the audience size, never the audience', () => {
    const event = buildClipPublishedEvent(CLIP, 'user-1', 4);
    expect(event.payload['audienceCount']).toBe(4);
    expect(JSON.stringify(event.payload)).not.toContain('member-');
    expect(
      buildClipRevisedEvent(CLIP, 'clip-2', 'user-1').payload[
        'successorClipId'
      ],
    ).toBe('clip-2');
  });

  it('audits an import with totals only', () => {
    const report = buildImportReport(true, 1, [
      buildRowResult('row-1', ClipImportOutcome.Imported, null),
    ]);
    const audit = buildImportAudit(
      'analysis.clip.imported',
      'user-1',
      'team-1',
      'season-1',
      report,
    );
    expect(audit.diff['received']).toBe(1);
    expect(JSON.stringify(audit.diff)).not.toContain('row-1');
  });
});

describe('clip import reconciler', () => {
  it('accounts for every received row exactly once', () => {
    const report = buildImportReport(false, 4, [
      buildRowResult('a', ClipImportOutcome.Imported, 'clip-1'),
      buildRowResult('b', ClipImportOutcome.SkippedDuplicate, 'clip-2'),
      buildRowResult('c', ClipImportOutcome.RejectedTimestamp, null),
      buildRowResult('d', ClipImportOutcome.RejectedAlias, null),
    ]);
    expect(report.imported).toBe(1);
    expect(report.skippedDuplicate).toBe(1);
    expect(report.rejectedTimestamp).toBe(1);
    expect(report.rejectedAlias).toBe(1);
    expect(isBalancedReport(report)).toBe(true);
  });

  it('detects an unbalanced reconciliation', () => {
    expect(isBalancedReport(buildImportReport(false, 9, []))).toBe(false);
    expect(countOutcome([], ClipImportOutcome.Imported)).toBe(0);
  });
});
