import { describe, expect, it } from 'vitest';

import {
  CandidateReadiness,
  CandidateStatus,
  ContactChannel,
  EvaluationRecommendation,
  OfferStatus,
  OfferTransition,
  TryoutDecisionValue,
  TryoutEventStatus,
  TryoutVisibility,
} from '../model/tryouts.enums';
import type {
  CandidateRow,
  DecisionRow,
  EvaluationRow,
  OfferRow,
  TryoutEventRow,
} from '../model/tryouts.rows';
import type {
  RegistrationVerdict,
  TryoutCandidate,
  TryoutEvent,
  TryoutOffer,
} from '../model/tryouts.types';
import {
  buildCandidateAudit,
  buildCandidateConvertedEvent,
  buildCandidateStatusChange,
  buildDecisionAudit,
  buildEvaluationUpsert,
  buildEventAudit,
  buildEventStatusChange,
  buildNewCandidate,
  buildNewDecision,
  buildNewOffer,
  buildNewTryoutEvent,
  buildOfferSentEvent,
  buildOfferStatusChange,
} from './tryouts.builders';
import {
  identityHash,
  isValidRating,
  normalizeIdentity,
  parseEnumValue,
  resolveTryoutsPage,
  sanitizeRatings,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './tryouts.helpers';
import {
  toCandidate,
  toDecision,
  toEvaluation,
  toFunnelCounts,
  toOffer,
  toTryoutEvent,
} from './tryouts.mapper';
import {
  toCandidateContent,
  toCandidateListFilter,
  toEvaluationContent,
  toTryoutEventContent,
} from './tryouts-command.mapper';

const NOW = new Date('2025-03-10T12:00:00.000Z');

const EVENT_ROW: TryoutEventRow = {
  id: 'event-1',
  team_id: 'team-1',
  season_id: 'season-1',
  venue_id: null,
  name: 'Spring',
  capacity: null,
  registration_opens_at: NOW,
  registration_closes_at: new Date('2025-03-20T00:00:00.000Z'),
  starts_at: new Date('2025-03-21T15:00:00.000Z'),
  ends_at: new Date('2025-03-21T18:00:00.000Z'),
  visibility: 'invite_only',
  consent_version: 'consent-v2',
  eligibility_note: null,
  retention_days: '30',
  status: 'draft',
  record_version: '1',
  created_by: 'user-1',
  opened_at: null,
  closed_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const CANDIDATE_ROW: CandidateRow = {
  id: 'cand-1',
  team_id: 'team-1',
  event_id: 'event-1',
  display_name: 'Nour',
  identity_hash: 'hash',
  contact_channel: 'email',
  contact_reference: 'nour@example.test',
  prior_sport: null,
  referral_source: null,
  motivation: null,
  communication_opt_in: true,
  consent_version: 'consent-v2',
  consented_at: NOW,
  readiness: 'unknown',
  restricted_notes: null,
  status: 'registered',
  waitlist_position: null,
  checked_in_at: null,
  withdrawn_at: null,
  duplicate_of_candidate_id: null,
  converted_membership_id: null,
  converted_at: null,
  retention_expires_at: new Date('2025-04-09T12:00:00.000Z'),
  anonymized_at: null,
  record_version: '1',
  created_by: null,
  created_at: NOW,
  updated_at: NOW,
};

const EVALUATION_ROW: EvaluationRow = {
  id: 'eval-1',
  team_id: 'team-1',
  candidate_id: 'cand-1',
  evaluator_user_id: 'user-2',
  criteria_version: 'criteria-v1',
  attended: true,
  ratings: { throwing: 4, bogus: 99 },
  observations: null,
  private_notes: 'private',
  recommendation: 'accept',
  status: 'submitted',
  record_version: '1',
  submitted_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

const DECISION_ROW: DecisionRow = {
  id: 'dec-1',
  team_id: 'team-1',
  candidate_id: 'cand-1',
  decision: 'accept',
  reasons: 'strong',
  criteria_version: 'criteria-v1',
  evaluator_count: '2',
  decided_by: 'user-3',
  decided_at: NOW,
};

const OFFER_ROW: OfferRow = {
  id: 'offer-1',
  team_id: 'team-1',
  candidate_id: 'cand-1',
  status: 'draft',
  candidate_message: null,
  expires_at: new Date('2025-03-24T12:00:00.000Z'),
  sent_at: null,
  responded_at: null,
  record_version: '1',
  created_by: 'user-3',
  created_at: NOW,
  updated_at: NOW,
};

const EVENT: TryoutEvent = toTryoutEvent(EVENT_ROW);
const CANDIDATE: TryoutCandidate = toCandidate(CANDIDATE_ROW);
const OFFER: TryoutOffer = toOffer(OFFER_ROW);
const ACCEPTED: RegistrationVerdict = {
  accepted: true,
  refusal: null,
  waitlisted: false,
};

describe('tryouts helpers', () => {
  it('clamps paging to the bounded window', () => {
    expect(resolveTryoutsPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveTryoutsPage(999, 5)).toEqual({ limit: 100, offset: 5 });
  });

  it('coerces driver values without inventing zeros', () => {
    expect(toDate(NOW)).toBe(NOW);
    expect(toDate('2025-01-01T00:00:00.000Z')).toBeInstanceOf(Date);
    expect(toNullableDate(null)).toBeNull();
    expect(toNumber('7')).toBe(7);
    expect(toNumber(7)).toBe(7);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('3')).toBe(3);
    expect(parseEnumValue(['a'], 'a', 'x')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'x')).toThrow(/x/u);
  });

  it('fingerprints a registrant one way and matches normalized names', () => {
    const first = identityHash('event-1', ' Nour  Adel ', 'Nour@Example.test');
    const second = identityHash('event-1', 'nour adel', 'nour@example.test');
    expect(first).toBe(second);
    expect(identityHash('event-2', 'Nour Adel', null)).not.toBe(first);
    expect(normalizeIdentity('  Éric  ')).toBe('eric');
  });

  it('drops out-of-range ratings instead of clamping them', () => {
    expect(isValidRating(3)).toBe(true);
    expect(isValidRating(9)).toBe(false);
    expect(isValidRating('4')).toBe(false);
    expect(sanitizeRatings({ throwing: 4, defence: 0, note: 'x' })).toEqual({
      throwing: 4,
    });
  });
});

describe('tryouts mapper', () => {
  it('maps an event, keeping a null capacity as no limit', () => {
    expect(EVENT.capacity).toBeNull();
    expect(EVENT.visibility).toBe(TryoutVisibility.InviteOnly);
    expect(EVENT.status).toBe(TryoutEventStatus.Draft);
  });

  it('maps a candidate', () => {
    expect(CANDIDATE.status).toBe(CandidateStatus.Registered);
    expect(CANDIDATE.contactChannel).toBe(ContactChannel.Email);
    expect(CANDIDATE.readiness).toBe(CandidateReadiness.Unknown);
  });

  it('maps an evaluation and sanitizes the stored ratings', () => {
    const evaluation = toEvaluation(EVALUATION_ROW);
    expect(evaluation.ratings).toEqual({ throwing: 4 });
    expect(evaluation.recommendation).toBe(EvaluationRecommendation.Accept);
  });

  it('maps decisions and offers', () => {
    expect(toDecision(DECISION_ROW).decision).toBe(TryoutDecisionValue.Accept);
    expect(OFFER.status).toBe(OfferStatus.Draft);
  });

  it('folds funnel counts into a lookup', () => {
    const counts = toFunnelCounts([
      { status: 'registered', count: '3' },
      { status: 'accepted', count: 1 },
    ]);
    expect(counts.get('registered')).toBe(3);
    expect(counts.get('accepted')).toBe(1);
  });
});

describe('tryouts command mapper', () => {
  it('defaults an event to invite-only', () => {
    const content = toTryoutEventContent({
      seasonId: 'season-1',
      name: ' Spring ',
      registrationOpensAt: '2025-03-01T00:00:00.000Z',
      registrationClosesAt: '2025-03-20T00:00:00.000Z',
      startsAt: '2025-03-21T15:00:00.000Z',
      endsAt: '2025-03-21T18:00:00.000Z',
      consentVersion: ' consent-v2 ',
    });
    expect(content.visibility).toBe(TryoutVisibility.InviteOnly);
    expect(content.name).toBe('Spring');
    expect(content.capacity).toBeNull();
    expect(content.retentionDays).toBe(365);
  });

  it('defaults a candidate to no channel, no opt-in, unknown readiness', () => {
    const content = toCandidateContent({
      eventId: 'event-1',
      displayName: ' Nour ',
      consentVersion: 'consent-v2',
    });
    expect(content.contactChannel).toBe(ContactChannel.None);
    expect(content.communicationOptIn).toBe(false);
    expect(content.readiness).toBe(CandidateReadiness.Unknown);
  });

  it('sanitizes evaluation ratings and defaults undecided', () => {
    const content = toEvaluationContent({
      criteriaVersion: 'criteria-v1',
      ratings: { throwing: 4, bad: 99 },
    });
    expect(content.ratings).toEqual({ throwing: 4 });
    expect(content.recommendation).toBe(EvaluationRecommendation.Undecided);
    expect(content.submit).toBe(false);
  });

  it('keeps every absent list facet null', () => {
    expect(toCandidateListFilter({})).toEqual({
      eventId: null,
      status: null,
      readiness: null,
    });
  });
});

describe('tryouts builders', () => {
  it('seats or waitlists a new candidate', () => {
    const seated = buildNewCandidate(
      'id-1',
      EVENT,
      toCandidateContent({
        eventId: 'event-1',
        displayName: 'Nour',
        consentVersion: 'consent-v2',
      }),
      'hash',
      ACCEPTED,
      0,
      new Date('2025-04-09T12:00:00.000Z'),
      'user-1',
      NOW,
    );
    expect(seated.status).toBe(CandidateStatus.Registered);
    expect(seated.waitlistPosition).toBeNull();
  });

  it('stamps only the instant an event transition owns', () => {
    const opened = buildEventStatusChange(
      EVENT,
      TryoutEventStatus.Open,
      1,
      NOW,
    );
    expect(opened.openedAt).toBe(NOW);
    expect(opened.closedAt).toBeNull();
    const built = buildNewTryoutEvent(
      'id-1',
      'team-1',
      toTryoutEventContent({
        seasonId: 'season-1',
        name: 'Spring',
        registrationOpensAt: '2025-03-01T00:00:00.000Z',
        registrationClosesAt: '2025-03-20T00:00:00.000Z',
        startsAt: '2025-03-21T15:00:00.000Z',
        endsAt: '2025-03-21T18:00:00.000Z',
        consentVersion: 'consent-v2',
      }),
      'user-1',
      NOW,
    );
    expect(built.consentVersion).toBe('consent-v2');
  });

  it('stamps only the instants a candidate move owns', () => {
    const checkedIn = buildCandidateStatusChange(
      CANDIDATE,
      CandidateStatus.CheckedIn,
      1,
      true,
      false,
      NOW,
    );
    expect(checkedIn.checkedInAt).toBe(NOW);
    expect(checkedIn.withdrawnAt).toBeNull();
  });

  it('audits classifications only, never personal detail', () => {
    const audit = buildCandidateAudit(
      'tryout.candidate.registered',
      'user-1',
      CANDIDATE,
      'season-1',
    );
    expect(JSON.stringify(audit.diff)).not.toContain('nour@example.test');
    expect(audit.diff['status']).toBe(CandidateStatus.Registered);
    expect(
      buildEventAudit('tryout.event.created', 'user-1', EVENT).diff[
        'consentVersion'
      ],
    ).toBe('consent-v2');
    expect(
      buildDecisionAudit(
        'tryout.decision.recorded',
        'user-3',
        toDecision(DECISION_ROW),
        'season-1',
      ).diff['decision'],
    ).toBe('accept');
  });

  it('builds evaluation, decision, and offer rows', () => {
    const upsert = buildEvaluationUpsert(
      'id-1',
      CANDIDATE,
      'user-2',
      toEvaluationContent({ criteriaVersion: 'criteria-v1', submit: true }),
      NOW,
    );
    expect(upsert.submittedAt).toBe(NOW);
    expect(
      buildNewDecision(
        'id-1',
        CANDIDATE,
        TryoutDecisionValue.Accept,
        'strong',
        'criteria-v1',
        2,
        'user-3',
        NOW,
      ).evaluatorCount,
    ).toBe(2);
    expect(
      buildNewOffer('id-1', CANDIDATE, null, NOW, 'user-3', NOW).candidateId,
    ).toBe('cand-1');
    const sent = buildOfferStatusChange(
      OFFER,
      OfferStatus.Sent,
      1,
      true,
      false,
      NOW,
    );
    expect(sent.sentAt).toBe(NOW);
  });

  it('emits privacy-safe events', () => {
    const sent = buildOfferSentEvent(OFFER, 'season-1', 'user-3');
    expect(sent.payload['offerId']).toBe('offer-1');
    expect(JSON.stringify(sent.payload)).not.toContain('nour');
    expect(
      buildCandidateConvertedEvent(CANDIDATE, 'member-1', 'season-1', 'user-3')
        .payload['membershipId'],
    ).toBe('member-1');
  });

  it('exposes every offer transition target', () => {
    expect(OfferTransition.Send).toBe('send');
  });
});
