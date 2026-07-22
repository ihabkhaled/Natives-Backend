import {
  ClipPlayContext,
  ClipVisibility,
  VideoAccessPolicy,
  VideoProcessingStatus,
} from '../model/analysis.enums';
import type {
  ClipImportRow,
  ClipImportRowInput,
  VideoClipContent,
  VideoClipContentInput,
  VideoClipListFilter,
  VideoClipListFilterInput,
  VideoSourceContent,
  VideoSourceContentInput,
  VideoSourceListFilter,
  VideoSourceListFilterInput,
} from '../model/analysis.types';
import { normalizeTag, normalizeTags, uniqueIds } from './analysis.helpers';

/**
 * Normalizes loosely-typed transport input into the strict command shapes.
 * Absent optional fields become explicit nulls or documented defaults — never
 * coerced away — so controllers stay a single delegation and downstream layers
 * never see `undefined`. An absent duration or end second stays null: unknown,
 * never zero.
 */
export function toVideoSourceContent(
  input: VideoSourceContentInput,
): VideoSourceContent {
  return {
    matchId: input.matchId ?? null,
    provider: input.provider,
    externalRef: input.externalRef.trim(),
    title: input.title.trim(),
    durationSeconds: input.durationSeconds ?? null,
    syncOffsetSeconds: input.syncOffsetSeconds ?? 0,
    processingStatus: input.processingStatus ?? VideoProcessingStatus.Pending,
    accessPolicy: input.accessPolicy ?? VideoAccessPolicy.Coaches,
  };
}

export function toVideoClipContent(
  input: VideoClipContentInput,
): VideoClipContent {
  return {
    sourceId: input.sourceId,
    pointId: input.pointId ?? null,
    eventId: input.eventId ?? null,
    startSecond: input.startSecond,
    endSecond: input.endSecond ?? null,
    playContext: input.playContext ?? ClipPlayContext.Unspecified,
    clipType: input.clipType,
    title: input.title.trim(),
    comment: input.comment ?? null,
    visibility: input.visibility ?? ClipVisibility.CoachOnly,
    membershipIds: uniqueIds(input.membershipIds ?? []),
    tags: normalizeTags(input.tags ?? []),
  };
}

/** The allow-listed source list filter; every absent facet stays null. */
export function toVideoSourceListFilter(
  input: VideoSourceListFilterInput,
): VideoSourceListFilter {
  return {
    matchId: input.matchId ?? null,
    provider: input.provider ?? null,
  };
}

/** The allow-listed clip queue filter; every absent facet stays null. */
export function toVideoClipListFilter(
  input: VideoClipListFilterInput,
): VideoClipListFilter {
  return {
    sourceId: input.sourceId ?? null,
    matchId: input.matchId ?? null,
    clipType: input.clipType ?? null,
    status: input.status ?? null,
    membershipId: input.membershipId ?? null,
    tag:
      input.tag === undefined || input.tag === null
        ? null
        : normalizeTag(input.tag),
  };
}

/** One audited import row, normalized. Aliases keep their source spelling. */
export function toClipImportRow(input: ClipImportRowInput): ClipImportRow {
  return {
    reference: input.reference.trim(),
    sourceId: input.sourceId,
    startSecond: input.startSecond,
    endSecond: input.endSecond ?? null,
    clipType: input.clipType,
    playContext: input.playContext ?? ClipPlayContext.Unspecified,
    title: input.title.trim(),
    comment: input.comment ?? null,
    playerAliases: (input.playerAliases ?? []).map(alias => alias.trim()),
    tags: normalizeTags(input.tags ?? []),
  };
}

export function toClipImportRows(
  inputs: readonly ClipImportRowInput[],
): readonly ClipImportRow[] {
  return inputs.map(input => toClipImportRow(input));
}
