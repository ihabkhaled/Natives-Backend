import type { TransactionScope } from '@core/persistence/unit-of-work.port';

import type { ReminderKind } from './calendar.enums';
import type { PracticeSession } from './practices.types';

export interface CalendarTokenCredential {
  readonly raw: string;
  readonly digest: string;
}

export interface CalendarTokenPort {
  issue(): CalendarTokenCredential;
  digest(raw: string): string;
}

export interface CalendarFeedToken {
  readonly id: string;
  readonly tokenDigest: string;
  readonly userId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly timezone: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export type NewCalendarFeedToken = CalendarFeedToken;

export interface CreateCalendarFeedCommand {
  readonly seasonId: string | null;
  readonly timezone: string | null;
  readonly expiresInDays: number | null;
}

export interface CalendarFeedCredentialView {
  readonly id: string;
  readonly token: string;
  readonly feedPath: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly timezone: string;
  readonly expiresAt: Date;
}

export interface CalendarFeedRevokeResult {
  readonly id: string;
  readonly revoked: boolean;
}

/**
 * Owner-facing feed metadata. Never carries the raw token or its digest — the
 * token is shown exactly once, in the POST response, by design.
 */
export interface CalendarFeedMetadataView {
  readonly id: string;
  readonly seasonId: string | null;
  readonly timezone: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** The caller's own active feeds (bounded by the per-user/team active limit). */
export interface ListCalendarFeedsResult {
  readonly items: readonly CalendarFeedMetadataView[];
}

export interface CalendarFeedSessionPage {
  readonly items: readonly PracticeSession[];
  readonly nextStartsAt: Date | null;
  readonly nextId: string | null;
}

export interface CalendarFeedSessionCursor {
  readonly startsAt: Date | null;
  readonly id: string | null;
}

export interface CalendarFeedWindow {
  readonly from: Date;
  readonly to: Date;
}

export interface ReminderPolicyInput {
  readonly now: Date;
  readonly startsAt: Date;
  readonly rsvpCutoffAt: Date | null;
  readonly hasResponded: boolean;
}

export interface ReminderCandidate {
  readonly sessionId: string;
  readonly sessionVersion: number;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly userId: string;
  readonly startsAt: Date;
  readonly rsvpCutoffAt: Date | null;
  readonly hasResponded: boolean;
}

export interface ReminderDispatchResult {
  readonly candidates: number;
  readonly enqueued: number;
}

export interface ReminderPreview {
  readonly sessionId: string;
  readonly totalEligible: number;
  readonly noResponse: number;
  readonly upcoming: boolean;
  readonly cutoff: boolean;
  readonly urgentCancellationOverride: boolean;
  readonly kinds: readonly ReminderKind[];
}

export interface ReminderTestResult {
  readonly enqueued: boolean;
  readonly reason: 'quiet_hours' | null;
}

export interface ReminderCollectionState {
  readonly teamId: string;
  readonly sessionId: string;
  readonly after: string | null;
  readonly collected: readonly ReminderCandidate[];
  readonly pageNumber: number;
}

export interface CalendarFeedRepositoryPort {
  findUsableByDigest(
    scope: TransactionScope,
    digest: string,
    now: Date,
  ): Promise<CalendarFeedToken | null>;
}
