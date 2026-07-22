import {
  CLIP_PLAY_CONTEXT_VALUES,
  CLIP_STATUS_VALUES,
  CLIP_TYPE_VALUES,
  CLIP_VISIBILITY_VALUES,
  VIDEO_ACCESS_POLICY_VALUES,
  VIDEO_PROCESSING_STATUS_VALUES,
  VIDEO_PROVIDER_VALUES,
} from '../model/analysis.enums';
import type {
  ClipPlayerRow,
  VideoClipRow,
  VideoSourceRow,
} from '../model/analysis.rows';
import type {
  ClipAcknowledgement,
  VideoClip,
  VideoSource,
} from '../model/analysis.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './analysis.helpers';

export function toVideoSource(row: VideoSourceRow): VideoSource {
  return {
    sourceId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    matchId: row.match_id,
    provider: parseEnumValue(VIDEO_PROVIDER_VALUES, row.provider, 'provider'),
    externalRef: row.external_ref,
    title: row.title,
    durationSeconds: toNullableNumber(row.duration_seconds),
    syncOffsetSeconds: toNumber(row.sync_offset_seconds),
    processingStatus: parseEnumValue(
      VIDEO_PROCESSING_STATUS_VALUES,
      row.processing_status,
      'processing status',
    ),
    accessPolicy: parseEnumValue(
      VIDEO_ACCESS_POLICY_VALUES,
      row.access_policy,
      'access policy',
    ),
    recordVersion: toNumber(row.record_version),
    registeredBy: row.registered_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toVideoClip(row: VideoClipRow): VideoClip {
  return {
    clipId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    sourceId: row.source_id,
    matchId: row.match_id,
    pointId: row.point_id,
    eventId: row.event_id,
    startSecond: toNumber(row.start_second),
    endSecond: toNullableNumber(row.end_second),
    playContext: parseEnumValue(
      CLIP_PLAY_CONTEXT_VALUES,
      row.play_context,
      'play context',
    ),
    clipType: parseEnumValue(CLIP_TYPE_VALUES, row.clip_type, 'clip type'),
    title: row.title,
    comment: row.comment,
    visibility: parseEnumValue(
      CLIP_VISIBILITY_VALUES,
      row.visibility,
      'visibility',
    ),
    status: parseEnumValue(CLIP_STATUS_VALUES, row.status, 'clip status'),
    revision: toNumber(row.revision),
    supersedesClipId: row.supersedes_clip_id,
    importReference: row.import_reference,
    recordVersion: toNumber(row.record_version),
    authorUserId: row.author_user_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: toNullableDate(row.reviewed_at),
    publishedBy: row.published_by,
    publishedAt: toNullableDate(row.published_at),
    archivedAt: toNullableDate(row.archived_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/**
 * Map a clip-player row into an acknowledgement. Only rows that actually carry
 * an instant become acknowledgements — a null `acknowledged_at` means "has not
 * acknowledged", never "acknowledged at the epoch".
 */
export function toClipAcknowledgement(
  row: ClipPlayerRow,
): ClipAcknowledgement | null {
  const acknowledgedAt = toNullableDate(row.acknowledged_at);
  if (acknowledgedAt === null) {
    return null;
  }
  return {
    clipId: row.clip_id,
    membershipId: row.membership_id,
    acknowledgedAt,
  };
}
