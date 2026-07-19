import type {
  EvidenceInput,
  EvidenceItem,
  SubmissionContent,
  SubmissionContentInput,
} from '../model/activity.types';

/** Normalize the transport submission content into the null-not-zero command shape. */
export function toSubmissionContent(
  input: SubmissionContentInput,
): SubmissionContent {
  return {
    activityTypeId: input.activityTypeId,
    seasonId: input.seasonId ?? null,
    performedOn: input.performedOn,
    durationMinutes: input.durationMinutes ?? null,
    quantity: input.quantity ?? null,
    notes: input.notes ?? null,
  };
}

/** Normalize evidence attachments, defaulting optional metadata to null. */
export function toEvidenceItems(
  inputs: readonly EvidenceInput[] | undefined,
): readonly EvidenceItem[] {
  return (inputs ?? []).map(input => ({
    kind: input.kind,
    storageReference: input.storageReference,
    contentType: input.contentType ?? null,
    byteSize: input.byteSize ?? null,
    description: input.description ?? null,
  }));
}

/** Normalize the optional buddy membership id list to a bounded array. */
export function toBuddyMembershipIds(
  ids: readonly string[] | undefined,
): readonly string[] {
  return ids ?? [];
}
