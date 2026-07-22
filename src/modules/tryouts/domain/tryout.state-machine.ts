import {
  CandidateStatus,
  OfferStatus,
  OfferTransition,
  TryoutDecisionValue,
  TryoutEventStatus,
  TryoutEventTransition,
} from '../model/tryouts.enums';

/**
 * The tryout state machines (UN-600, UN-601). Pure and total.
 *
 * Event:      draft → open → closed → completed, and cancel from any live state.
 * Candidate:  registered/waitlisted → checked_in | no_show | withdrawn, then the
 *             committee decision moves it to accepted or rejected, and exactly
 *             one conversion moves an accepted candidate to converted.
 * Offer:      draft → sent → accepted | declined | expired, withdrawable while
 *             live. `accepted` is terminal — the conversion reads it, never
 *             rewrites it.
 */
const EVENT_ALLOWED: ReadonlyMap<
  TryoutEventStatus,
  readonly TryoutEventStatus[]
> = new Map([
  [
    TryoutEventStatus.Draft,
    [TryoutEventStatus.Open, TryoutEventStatus.Cancelled],
  ],
  [
    TryoutEventStatus.Open,
    [TryoutEventStatus.Closed, TryoutEventStatus.Cancelled],
  ],
  [
    TryoutEventStatus.Closed,
    [TryoutEventStatus.Completed, TryoutEventStatus.Cancelled],
  ],
  [TryoutEventStatus.Completed, []],
  [TryoutEventStatus.Cancelled, []],
]);

const EVENT_TARGETS: ReadonlyMap<TryoutEventTransition, TryoutEventStatus> =
  new Map([
    [TryoutEventTransition.Open, TryoutEventStatus.Open],
    [TryoutEventTransition.Close, TryoutEventStatus.Closed],
    [TryoutEventTransition.Complete, TryoutEventStatus.Completed],
    [TryoutEventTransition.Cancel, TryoutEventStatus.Cancelled],
  ]);

const CANDIDATE_ALLOWED: ReadonlyMap<
  CandidateStatus,
  readonly CandidateStatus[]
> = new Map([
  [
    CandidateStatus.Registered,
    [
      CandidateStatus.CheckedIn,
      CandidateStatus.NoShow,
      CandidateStatus.Withdrawn,
      CandidateStatus.Accepted,
      CandidateStatus.Rejected,
      CandidateStatus.Waitlisted,
    ],
  ],
  [
    CandidateStatus.Waitlisted,
    [
      CandidateStatus.Registered,
      CandidateStatus.CheckedIn,
      CandidateStatus.Withdrawn,
      CandidateStatus.Rejected,
    ],
  ],
  [
    CandidateStatus.CheckedIn,
    [
      CandidateStatus.Accepted,
      CandidateStatus.Rejected,
      CandidateStatus.Withdrawn,
    ],
  ],
  [CandidateStatus.NoShow, [CandidateStatus.Rejected]],
  [CandidateStatus.Accepted, [CandidateStatus.Converted]],
  [CandidateStatus.Rejected, []],
  [CandidateStatus.Withdrawn, []],
  [CandidateStatus.Converted, []],
]);

const OFFER_ALLOWED: ReadonlyMap<OfferStatus, readonly OfferStatus[]> = new Map(
  [
    [OfferStatus.Draft, [OfferStatus.Sent, OfferStatus.Withdrawn]],
    [
      OfferStatus.Sent,
      [
        OfferStatus.Accepted,
        OfferStatus.Declined,
        OfferStatus.Expired,
        OfferStatus.Withdrawn,
      ],
    ],
    [OfferStatus.Accepted, []],
    [OfferStatus.Declined, []],
    [OfferStatus.Expired, []],
    [OfferStatus.Withdrawn, []],
  ],
);

const OFFER_TARGETS: ReadonlyMap<OfferTransition, OfferStatus> = new Map([
  [OfferTransition.Send, OfferStatus.Sent],
  [OfferTransition.Accept, OfferStatus.Accepted],
  [OfferTransition.Decline, OfferStatus.Declined],
  [OfferTransition.Expire, OfferStatus.Expired],
  [OfferTransition.Withdraw, OfferStatus.Withdrawn],
]);

const DECISION_TARGETS: ReadonlyMap<TryoutDecisionValue, CandidateStatus> =
  new Map([
    [TryoutDecisionValue.Accept, CandidateStatus.Accepted],
    [TryoutDecisionValue.Waitlist, CandidateStatus.Waitlisted],
    [TryoutDecisionValue.Reject, CandidateStatus.Rejected],
    [TryoutDecisionValue.Withdraw, CandidateStatus.Withdrawn],
  ]);

export function eventTargetOf(
  transition: TryoutEventTransition,
): TryoutEventStatus {
  return EVENT_TARGETS.get(transition) ?? TryoutEventStatus.Draft;
}

export function canTransitionEvent(
  from: TryoutEventStatus,
  to: TryoutEventStatus,
): boolean {
  return (EVENT_ALLOWED.get(from) ?? []).includes(to);
}

export function canTransitionCandidate(
  from: CandidateStatus,
  to: CandidateStatus,
): boolean {
  return (CANDIDATE_ALLOWED.get(from) ?? []).includes(to);
}

export function candidateTargetOf(
  decision: TryoutDecisionValue,
): CandidateStatus {
  return DECISION_TARGETS.get(decision) ?? CandidateStatus.Registered;
}

export function offerTargetOf(transition: OfferTransition): OfferStatus {
  return OFFER_TARGETS.get(transition) ?? OfferStatus.Draft;
}

export function canTransitionOffer(
  from: OfferStatus,
  to: OfferStatus,
): boolean {
  return (OFFER_ALLOWED.get(from) ?? []).includes(to);
}

/** Whether an offer has run out of time at this instant. */
export function isOfferExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Whether the candidate is eligible for exactly one conversion. */
export function isConvertible(status: CandidateStatus): boolean {
  return status === CandidateStatus.Accepted;
}

export function isConverted(status: CandidateStatus): boolean {
  return status === CandidateStatus.Converted;
}
