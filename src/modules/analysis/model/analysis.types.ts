import type {
  ClipImportOutcome,
  ClipPlayContext,
  ClipStatus,
  ClipTimestampIssue,
  ClipTransition,
  ClipType,
  ClipVisibility,
  VideoAccessPolicy,
  VideoProcessingStatus,
  VideoProvider,
} from './analysis.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Video source ------------------------------------------------------------

/**
 * A registered recording. `durationSeconds` is null when the provider has not
 * reported one — unknown, never zero — and the timestamp policy treats that as
 * "no upper bound is checkable" rather than "everything is out of range".
 */
export interface VideoSource {
  readonly sourceId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly matchId: string | null;
  readonly provider: VideoProvider;
  readonly externalRef: string;
  readonly title: string;
  readonly durationSeconds: number | null;
  readonly syncOffsetSeconds: number;
  readonly processingStatus: VideoProcessingStatus;
  readonly accessPolicy: VideoAccessPolicy;
  readonly recordVersion: number;
  readonly registeredBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A fully-resolved new source row ready for insertion. */
export interface NewVideoSource {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly matchId: string | null;
  readonly provider: VideoProvider;
  readonly externalRef: string;
  readonly title: string;
  readonly durationSeconds: number | null;
  readonly syncOffsetSeconds: number;
  readonly processingStatus: VideoProcessingStatus;
  readonly accessPolicy: VideoAccessPolicy;
  readonly registeredBy: string;
  readonly now: Date;
}

/** Author-supplied content of a source registration. */
export interface VideoSourceContent {
  readonly matchId: string | null;
  readonly provider: VideoProvider;
  readonly externalRef: string;
  readonly title: string;
  readonly durationSeconds: number | null;
  readonly syncOffsetSeconds: number;
  readonly processingStatus: VideoProcessingStatus;
  readonly accessPolicy: VideoAccessPolicy;
}

export interface VideoSourceContentInput {
  readonly matchId?: string | null;
  readonly provider: VideoProvider;
  readonly externalRef: string;
  readonly title: string;
  readonly durationSeconds?: number | null;
  readonly syncOffsetSeconds?: number | null;
  readonly processingStatus?: VideoProcessingStatus | null;
  readonly accessPolicy?: VideoAccessPolicy | null;
}

export interface RegisterVideoSourceCommand {
  readonly content: VideoSourceContent;
}

export type VideoSourcePage = PagedResult<VideoSource>;

/** Bounded, allow-listed filter for the source list. */
export interface VideoSourceListFilter {
  readonly matchId: string | null;
  readonly provider: VideoProvider | null;
}

export interface VideoSourceListFilterInput {
  readonly matchId?: string | null;
  readonly provider?: VideoProvider | null;
}

// --- Signed provider access --------------------------------------------------

/** What the access adapter is asked to sign. Never any personal data. */
export interface VideoAccessRequest {
  readonly provider: VideoProvider;
  readonly externalRef: string;
  readonly now: Date;
}

/**
 * A short-lived provider handle. The application hands back a signed URL and its
 * expiry; it never streams or re-hosts the recording.
 */
export interface VideoAccessTicket {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface VideoAccessPort {
  createAccessTicket(request: VideoAccessRequest): VideoAccessTicket;
}

/** The resolved ticket plus the source it belongs to, for the response. */
export interface VideoAccessGrant {
  readonly sourceId: string;
  readonly provider: VideoProvider;
  readonly url: string;
  readonly expiresAt: Date;
  readonly syncOffsetSeconds: number;
}

// --- Clips -------------------------------------------------------------------

/** The full persisted analysis clip. */
export interface VideoClip {
  readonly clipId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly sourceId: string;
  readonly matchId: string | null;
  readonly pointId: string | null;
  readonly eventId: string | null;
  readonly startSecond: number;
  readonly endSecond: number | null;
  readonly playContext: ClipPlayContext;
  readonly clipType: ClipType;
  readonly title: string;
  readonly comment: string | null;
  readonly visibility: ClipVisibility;
  readonly status: ClipStatus;
  readonly revision: number;
  readonly supersedesClipId: string | null;
  readonly importReference: string | null;
  readonly recordVersion: number;
  readonly authorUserId: string | null;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A fully-resolved new clip row ready for insertion. */
export interface NewVideoClip {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly sourceId: string;
  readonly matchId: string | null;
  readonly pointId: string | null;
  readonly eventId: string | null;
  readonly startSecond: number;
  readonly endSecond: number | null;
  readonly playContext: ClipPlayContext;
  readonly clipType: ClipType;
  readonly title: string;
  readonly comment: string | null;
  readonly visibility: ClipVisibility;
  readonly revision: number;
  readonly supersedesClipId: string | null;
  readonly importReference: string | null;
  readonly authorUserId: string;
  readonly now: Date;
}

/** Author-supplied clip content. */
export interface VideoClipContent {
  readonly sourceId: string;
  readonly pointId: string | null;
  readonly eventId: string | null;
  readonly startSecond: number;
  readonly endSecond: number | null;
  readonly playContext: ClipPlayContext;
  readonly clipType: ClipType;
  readonly title: string;
  readonly comment: string | null;
  readonly visibility: ClipVisibility;
  readonly membershipIds: readonly string[];
  readonly tags: readonly string[];
}

export interface VideoClipContentInput {
  readonly sourceId: string;
  readonly pointId?: string | null;
  readonly eventId?: string | null;
  readonly startSecond: number;
  readonly endSecond?: number | null;
  readonly playContext?: ClipPlayContext | null;
  readonly clipType: ClipType;
  readonly title: string;
  readonly comment?: string | null;
  readonly visibility?: ClipVisibility | null;
  readonly membershipIds?: readonly string[] | null;
  readonly tags?: readonly string[] | null;
}

export interface CreateVideoClipCommand {
  readonly content: VideoClipContent;
}

export interface TransitionVideoClipCommand {
  readonly transition: ClipTransition;
  readonly expectedRecordVersion: number;
}

export interface ReviseVideoClipCommand {
  readonly content: VideoClipContent;
  readonly reason: string;
  readonly expectedRecordVersion: number;
}

/** An optimistic-version-guarded lifecycle change of a clip. */
export interface ClipStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: ClipStatus;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly now: Date;
}

export type VideoClipPage = PagedResult<VideoClipView>;

/**
 * A clip as returned to a caller: the record plus its tags, the memberships it
 * is about, and whether the requesting player already acknowledged it. The
 * `comment` is nulled by the visibility policy when the viewer may not read it —
 * a coach-only note never leaves the coaching group.
 */
export interface VideoClipView {
  readonly clip: VideoClip;
  readonly tags: readonly string[];
  readonly membershipIds: readonly string[];
  readonly acknowledgedMembershipIds: readonly string[];
}

/** Bounded, allow-listed filter for the clip queue. */
export interface VideoClipListFilter {
  readonly sourceId: string | null;
  readonly matchId: string | null;
  readonly clipType: ClipType | null;
  readonly status: ClipStatus | null;
  readonly membershipId: string | null;
  readonly tag: string | null;
}

export interface VideoClipListFilterInput {
  readonly sourceId?: string | null;
  readonly matchId?: string | null;
  readonly clipType?: ClipType | null;
  readonly status?: ClipStatus | null;
  readonly membershipId?: string | null;
  readonly tag?: string | null;
}

/** The viewer facts the visibility policy decides on. Never a raw role string. */
export interface ClipViewer {
  readonly userId: string;
  readonly canReadTeamAnalysis: boolean;
  readonly membershipIds: readonly string[];
}

// --- Timestamp validation ----------------------------------------------------

/** The timestamp window a clip claims, measured against a known duration. */
export interface ClipWindow {
  readonly startSecond: number;
  readonly endSecond: number | null;
}

/** The timestamp verdict. `issue` is null when the window is acceptable. */
export interface ClipTimestampVerdict {
  readonly valid: boolean;
  readonly issue: ClipTimestampIssue | null;
}

// --- Acknowledgement ---------------------------------------------------------

/** One tagged player's acknowledgement of a published clip. */
export interface ClipAcknowledgement {
  readonly clipId: string;
  readonly membershipId: string;
  readonly acknowledgedAt: Date;
}

// --- Import ------------------------------------------------------------------

/**
 * One row of an audited analysis import. The alias is the legacy spreadsheet
 * spelling of a player; it is resolved through the member alias table and is
 * never silently dropped when it does not match.
 */
export interface ClipImportRow {
  readonly reference: string;
  readonly sourceId: string;
  readonly startSecond: number;
  readonly endSecond: number | null;
  readonly clipType: ClipType;
  readonly playContext: ClipPlayContext;
  readonly title: string;
  readonly comment: string | null;
  readonly playerAliases: readonly string[];
  readonly tags: readonly string[];
}

export interface ClipImportRowInput {
  readonly reference: string;
  readonly sourceId: string;
  readonly startSecond: number;
  readonly endSecond?: number | null;
  readonly clipType: ClipType;
  readonly playContext?: ClipPlayContext | null;
  readonly title: string;
  readonly comment?: string | null;
  readonly playerAliases?: readonly string[] | null;
  readonly tags?: readonly string[] | null;
}

export interface ImportVideoClipsCommand {
  readonly dryRun: boolean;
  readonly rows: readonly ClipImportRow[];
}

/** The per-row outcome of an import. Redacted: reference and verdict only. */
export interface ClipImportRowResult {
  readonly reference: string;
  readonly outcome: ClipImportOutcome;
  readonly clipId: string | null;
}

/** The reconciliation totals of one import run. */
export interface ClipImportReport {
  readonly dryRun: boolean;
  readonly received: number;
  readonly imported: number;
  readonly skippedDuplicate: number;
  readonly rejectedTimestamp: number;
  readonly rejectedAlias: number;
  readonly rows: readonly ClipImportRowResult[];
}

/** The resolved team/season scope of an analysis operation. */
export interface AnalysisScope {
  readonly teamId: string;
  readonly seasonId: string;
}
