import { describe, expect, it } from 'vitest';

import { MILLISECONDS_PER_DAY } from '../model/tryouts.constants';
import {
  CandidateAudience,
  CandidateReadiness,
  CandidateStatus,
  ContactChannel,
  EvaluationRecommendation,
  EvaluationStatus,
  OfferStatus,
  OfferTransition,
  RegistrationRefusal,
  TryoutDecisionValue,
  TryoutEventStatus,
  TryoutEventTransition,
  TryoutVisibility,
} from '../model/tryouts.enums';
import type {
  TryoutCandidate,
  TryoutEvaluation,
  TryoutEvent,
} from '../model/tryouts.types';
import {
  anonymizeCandidate,
  canContactCandidate,
  hasContactChannel,
  isRetentionExpired,
  isStaffAudience,
  redactCandidate,
} from './candidate-privacy.policy';
import {
  aggregateEvaluations,
  averageRating,
  countRecommendations,
  distinctCriteriaVersions,
  hasQuorum,
} from './evaluation-aggregation.policy';
import {
  candidateTargetOf,
  canTransitionCandidate,
  canTransitionEvent,
  canTransitionOffer,
  eventTargetOf,
  isConverted,
  isConvertible,
  isOfferExpired,
  offerTargetOf,
} from './tryout.state-machine';
import {
  evaluateRegistration,
  initialStatusOf,
  isAtCapacity,
  isWithinWindow,
  retentionExpiryOf,
  waitlistPositionOf,
} from './tryout-registration.policy';

const NOW = new Date('2025-03-10T12:00:00.000Z');

function event(overrides: Partial<TryoutEvent> = {}): TryoutEvent {
  return {
    eventId: 'event-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    venueId: null,
    name: 'Spring tryout',
    capacity: 2,
    registrationOpensAt: new Date('2025-03-01T00:00:00.000Z'),
    registrationClosesAt: new Date('2025-03-20T00:00:00.000Z'),
    startsAt: new Date('2025-03-21T15:00:00.000Z'),
    endsAt: new Date('2025-03-21T18:00:00.000Z'),
    visibility: TryoutVisibility.Public,
    consentVersion: 'consent-v2',
    eligibilityNote: null,
    retentionDays: 30,
    status: TryoutEventStatus.Open,
    recordVersion: 1,
    createdBy: 'user-1',
    openedAt: null,
    closedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function candidate(overrides: Partial<TryoutCandidate> = {}): TryoutCandidate {
  return {
    candidateId: 'cand-1',
    teamId: 'team-1',
    eventId: 'event-1',
    displayName: 'Nour Adel',
    identityHash: 'hash',
    contactChannel: ContactChannel.Email,
    contactReference: 'nour@example.test',
    priorSport: 'basketball',
    referralSource: 'friend',
    motivation: 'want to play',
    communicationOptIn: true,
    consentVersion: 'consent-v2',
    consentedAt: NOW,
    readiness: CandidateReadiness.Limited,
    restrictedNotes: 'ankle sprain last month',
    status: CandidateStatus.Registered,
    waitlistPosition: null,
    checkedInAt: null,
    withdrawnAt: null,
    duplicateOfCandidateId: null,
    convertedMembershipId: null,
    convertedAt: null,
    retentionExpiresAt: new Date('2025-04-09T12:00:00.000Z'),
    anonymizedAt: null,
    recordVersion: 1,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function evaluation(
  overrides: Partial<TryoutEvaluation> = {},
): TryoutEvaluation {
  return {
    evaluationId: 'eval-1',
    teamId: 'team-1',
    candidateId: 'cand-1',
    evaluatorUserId: 'user-2',
    criteriaVersion: 'criteria-v1',
    attended: true,
    ratings: { throwing: 4, defence: 2 },
    observations: null,
    privateNotes: 'private',
    recommendation: EvaluationRecommendation.Accept,
    status: EvaluationStatus.Submitted,
    recordVersion: 1,
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('tryout registration policy', () => {
  it('accepts a registration inside the window with the right consent', () => {
    expect(evaluateRegistration(event(), 'consent-v2', 0, NOW)).toEqual({
      accepted: true,
      refusal: null,
      waitlisted: false,
    });
  });

  it('refuses a registration when the event is not open', () => {
    expect(
      evaluateRegistration(
        event({ status: TryoutEventStatus.Draft }),
        'consent-v2',
        0,
        NOW,
      ).refusal,
    ).toBe(RegistrationRefusal.EventNotOpen);
  });

  it('refuses a registration outside the published window', () => {
    expect(
      evaluateRegistration(
        event(),
        'consent-v2',
        0,
        new Date('2025-04-01T00:00:00.000Z'),
      ).refusal,
    ).toBe(RegistrationRefusal.WindowClosed);
    expect(isWithinWindow(event(), NOW)).toBe(true);
  });

  it('refuses an outdated consent version instead of upgrading it', () => {
    expect(evaluateRegistration(event(), 'consent-v1', 0, NOW).refusal).toBe(
      RegistrationRefusal.ConsentVersionMismatch,
    );
  });

  it('waitlists rather than refusing once the seats are taken', () => {
    const verdict = evaluateRegistration(event(), 'consent-v2', 2, NOW);
    expect(verdict.accepted).toBe(true);
    expect(verdict.waitlisted).toBe(true);
    expect(initialStatusOf(verdict)).toBe(CandidateStatus.Waitlisted);
    expect(waitlistPositionOf(verdict, event(), 2)).toBe(1);
  });

  it('treats a null capacity as no limit, never as zero seats', () => {
    expect(isAtCapacity(event({ capacity: null }), 500)).toBe(false);
    const verdict = evaluateRegistration(
      event({ capacity: null }),
      'consent-v2',
      500,
      NOW,
    );
    expect(verdict.waitlisted).toBe(false);
    expect(initialStatusOf(verdict)).toBe(CandidateStatus.Registered);
    expect(
      waitlistPositionOf(verdict, event({ capacity: null }), 5),
    ).toBeNull();
  });

  it('stamps the retention deadline from the event policy', () => {
    expect(
      retentionExpiryOf(event(), NOW, MILLISECONDS_PER_DAY).toISOString(),
    ).toBe('2025-04-09T12:00:00.000Z');
  });
});

describe('candidate privacy policy', () => {
  const staff = {
    audience: CandidateAudience.Staff,
    canReadContacts: false,
    canReadReadiness: false,
  };
  const full = {
    audience: CandidateAudience.Restricted,
    canReadContacts: true,
    canReadReadiness: true,
  };
  const publicViewer = {
    audience: CandidateAudience.Public,
    canReadContacts: false,
    canReadReadiness: false,
  };

  it('redacts contacts and health notes without the matching tiers', () => {
    const redacted = redactCandidate(candidate(), staff);
    expect(redacted.contactReference).toBeNull();
    expect(redacted.restrictedNotes).toBeNull();
    expect(redacted.motivation).toBe('want to play');
  });

  it('keeps restricted fields for a fully permitted reader', () => {
    const redacted = redactCandidate(candidate(), full);
    expect(redacted.contactReference).toBe('nour@example.test');
    expect(redacted.restrictedNotes).toBe('ankle sprain last month');
  });

  it('hides every free answer from a public audience', () => {
    const redacted = redactCandidate(candidate(), publicViewer);
    expect(redacted.motivation).toBeNull();
    expect(redacted.priorSport).toBeNull();
    expect(redacted.referralSource).toBeNull();
    expect(isStaffAudience(publicViewer)).toBe(false);
  });

  it('never assumes consent to contact from the presence of an address', () => {
    expect(canContactCandidate(candidate())).toBe(true);
    expect(canContactCandidate(candidate({ communicationOptIn: false }))).toBe(
      false,
    );
    expect(
      hasContactChannel(candidate({ contactChannel: ContactChannel.None })),
    ).toBe(false);
  });

  it('detects an elapsed retention window and skips an anonymized row', () => {
    expect(
      isRetentionExpired(candidate(), new Date('2025-05-01T00:00:00.000Z')),
    ).toBe(true);
    expect(isRetentionExpired(candidate(), NOW)).toBe(false);
    expect(
      isRetentionExpired(
        candidate({ anonymizedAt: NOW }),
        new Date('2025-05-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('anonymizes every personal field but keeps the row countable', () => {
    const anonymized = anonymizeCandidate(candidate(), NOW);
    expect(anonymized.displayName).toBe('anonymized');
    expect(anonymized.contactReference).toBeNull();
    expect(anonymized.restrictedNotes).toBeNull();
    expect(anonymized.contactChannel).toBe(ContactChannel.None);
    expect(anonymized.status).toBe(CandidateStatus.Registered);
    expect(anonymized.anonymizedAt).toBe(NOW);
  });
});

describe('evaluation aggregation policy', () => {
  it('summarises originals without producing a verdict', () => {
    const aggregate = aggregateEvaluations('cand-1', [
      evaluation(),
      evaluation({
        evaluationId: 'eval-2',
        evaluatorUserId: 'user-3',
        recommendation: EvaluationRecommendation.Reject,
        ratings: { throwing: 2 },
      }),
      evaluation({
        evaluationId: 'eval-3',
        evaluatorUserId: 'user-4',
        status: EvaluationStatus.Draft,
      }),
    ]);
    expect(aggregate.evaluatorCount).toBe(3);
    expect(aggregate.submittedCount).toBe(2);
    expect(aggregate.attendedCount).toBe(2);
    expect(aggregate.averageRating).toBeCloseTo(8 / 3);
    expect(aggregate).not.toHaveProperty('recommendation');
    expect(aggregate.recommendationCounts['accept']).toBe(1);
    expect(aggregate.criteriaVersions).toEqual(['criteria-v1']);
  });

  it('reports a null average when nothing was rated, never zero', () => {
    expect(averageRating([evaluation({ ratings: {} })])).toBeNull();
    expect(aggregateEvaluations('cand-1', []).averageRating).toBeNull();
  });

  it('counts every recommendation bucket and distinct criteria version', () => {
    const counts = countRecommendations([evaluation()]);
    expect(counts['accept']).toBe(1);
    expect(counts['reject']).toBe(0);
    expect(
      distinctCriteriaVersions([
        evaluation(),
        evaluation({ criteriaVersion: 'criteria-v2' }),
      ]),
    ).toEqual(['criteria-v1', 'criteria-v2']);
  });

  it('reports quorum only as advice', () => {
    const aggregate = aggregateEvaluations('cand-1', [evaluation()]);
    expect(hasQuorum(aggregate, 1)).toBe(true);
    expect(hasQuorum(aggregate, 3)).toBe(false);
  });
});

describe('tryout state machines', () => {
  it('walks the event lifecycle and refuses illegal moves', () => {
    expect(eventTargetOf(TryoutEventTransition.Open)).toBe(
      TryoutEventStatus.Open,
    );
    expect(eventTargetOf(TryoutEventTransition.Close)).toBe(
      TryoutEventStatus.Closed,
    );
    expect(eventTargetOf(TryoutEventTransition.Complete)).toBe(
      TryoutEventStatus.Completed,
    );
    expect(eventTargetOf(TryoutEventTransition.Cancel)).toBe(
      TryoutEventStatus.Cancelled,
    );
    expect(
      canTransitionEvent(TryoutEventStatus.Draft, TryoutEventStatus.Open),
    ).toBe(true);
    expect(
      canTransitionEvent(TryoutEventStatus.Completed, TryoutEventStatus.Open),
    ).toBe(false);
  });

  it('walks the candidate lifecycle and maps each decision', () => {
    expect(
      canTransitionCandidate(
        CandidateStatus.Registered,
        CandidateStatus.CheckedIn,
      ),
    ).toBe(true);
    expect(
      canTransitionCandidate(
        CandidateStatus.Converted,
        CandidateStatus.Accepted,
      ),
    ).toBe(false);
    expect(candidateTargetOf(TryoutDecisionValue.Accept)).toBe(
      CandidateStatus.Accepted,
    );
    expect(candidateTargetOf(TryoutDecisionValue.Waitlist)).toBe(
      CandidateStatus.Waitlisted,
    );
    expect(candidateTargetOf(TryoutDecisionValue.Reject)).toBe(
      CandidateStatus.Rejected,
    );
    expect(candidateTargetOf(TryoutDecisionValue.Withdraw)).toBe(
      CandidateStatus.Withdrawn,
    );
    expect(isConvertible(CandidateStatus.Accepted)).toBe(true);
    expect(isConvertible(CandidateStatus.Registered)).toBe(false);
    expect(isConverted(CandidateStatus.Converted)).toBe(true);
  });

  it('walks the offer lifecycle and detects expiry', () => {
    expect(offerTargetOf(OfferTransition.Send)).toBe(OfferStatus.Sent);
    expect(offerTargetOf(OfferTransition.Accept)).toBe(OfferStatus.Accepted);
    expect(offerTargetOf(OfferTransition.Decline)).toBe(OfferStatus.Declined);
    expect(offerTargetOf(OfferTransition.Expire)).toBe(OfferStatus.Expired);
    expect(offerTargetOf(OfferTransition.Withdraw)).toBe(OfferStatus.Withdrawn);
    expect(canTransitionOffer(OfferStatus.Draft, OfferStatus.Sent)).toBe(true);
    expect(canTransitionOffer(OfferStatus.Accepted, OfferStatus.Declined)).toBe(
      false,
    );
    expect(isOfferExpired(new Date('2025-01-01T00:00:00.000Z'), NOW)).toBe(
      true,
    );
    expect(isOfferExpired(new Date('2025-12-01T00:00:00.000Z'), NOW)).toBe(
      false,
    );
  });
});
