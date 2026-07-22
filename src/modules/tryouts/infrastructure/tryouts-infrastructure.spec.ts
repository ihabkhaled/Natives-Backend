import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  CandidateReadiness,
  CandidateStatus,
  ContactChannel,
  EvaluationRecommendation,
  EvaluationStatus,
  OfferStatus,
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
import { TryoutCandidateRepository } from './tryout-candidate.repository';
import { TryoutEventRepository } from './tryout-event.repository';
import { TryoutSelectionRepository } from './tryout-selection.repository';

const NOW = new Date('2025-03-10T12:00:00.000Z');

const EVENT_ROW: TryoutEventRow = {
  id: 'event-1',
  team_id: 'team-1',
  season_id: 'season-1',
  venue_id: null,
  name: 'Spring',
  capacity: null,
  registration_opens_at: NOW,
  registration_closes_at: NOW,
  starts_at: NOW,
  ends_at: NOW,
  visibility: 'invite_only',
  consent_version: 'consent-v2',
  eligibility_note: null,
  retention_days: 30,
  status: 'draft',
  record_version: 1,
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
  contact_reference: 'n@e.test',
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
  retention_expires_at: NOW,
  anonymized_at: null,
  record_version: 1,
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
  ratings: {},
  observations: null,
  private_notes: null,
  recommendation: 'accept',
  status: 'submitted',
  record_version: 1,
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
  evaluator_count: 2,
  decided_by: 'user-3',
  decided_at: NOW,
};

const OFFER_ROW: OfferRow = {
  id: 'offer-1',
  team_id: 'team-1',
  candidate_id: 'cand-1',
  status: 'draft',
  candidate_message: null,
  expires_at: NOW,
  sent_at: null,
  responded_at: null,
  record_version: 1,
  created_by: 'user-3',
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

describe('TryoutEventRepository', () => {
  const repository = new TryoutEventRepository();
  const newEvent = {
    id: 'event-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    venueId: null,
    name: 'Spring',
    capacity: null,
    registrationOpensAt: NOW.toISOString(),
    registrationClosesAt: NOW.toISOString(),
    startsAt: NOW.toISOString(),
    endsAt: NOW.toISOString(),
    visibility: TryoutVisibility.InviteOnly,
    consentVersion: 'consent-v2',
    eligibilityNote: null,
    retentionDays: 30,
    createdBy: 'user-1',
    now: NOW,
  };

  it('inserts an event as a draft', async () => {
    const { scope, run } = scopeReturning([EVENT_ROW]);
    expect((await repository.insert(scope, newEvent)).status).toBe(
      TryoutEventStatus.Draft,
    );
    expect(String(run.mock.calls[0]?.[0])).toContain(`'draft'`);
  });

  it('throws when an event write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newEvent)).rejects.toThrow(
      /tryout event write/u,
    );
  });

  it('resolves and hides events by team ownership', async () => {
    const found = scopeReturning([EVENT_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'event-1'))
        ?.eventId,
    ).toBe('event-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findForWrite(missing.scope, 'team-1', 'event-9'),
    ).toBeNull();
  });

  it('guards a status change with the expected record version', async () => {
    const applied = scopeReturning([{ ...EVENT_ROW, status: 'open' }]);
    expect(
      (
        await repository.applyStatusChange(applied.scope, {
          id: 'event-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: TryoutEventStatus.Open,
          openedAt: NOW,
          closedAt: null,
          completedAt: null,
          cancelledAt: null,
          now: NOW,
        })
      )?.status,
    ).toBe(TryoutEventStatus.Open);
    const stale = scopeReturning([]);
    expect(
      await repository.applyStatusChange(stale.scope, {
        id: 'event-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        toStatus: TryoutEventStatus.Open,
        openedAt: NOW,
        closedAt: null,
        completedAt: null,
        cancelledAt: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('bounds the list and probes team and season scope', async () => {
    const list = scopeReturning([EVENT_ROW]);
    expect(
      await repository.listForTeam(list.scope, 'team-1', {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 2 }]);
    expect(await repository.countForTeam(count.scope, 'team-1')).toBe(2);
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
    const season = scopeReturning([]);
    expect(
      await repository.seasonExistsInTeam(season.scope, 'team-1', 'season-9'),
    ).toBe(false);
  });
});

describe('TryoutCandidateRepository', () => {
  const repository = new TryoutCandidateRepository();
  const newCandidate = {
    id: 'cand-1',
    teamId: 'team-1',
    eventId: 'event-1',
    displayName: 'Nour',
    identityHash: 'hash',
    contactChannel: ContactChannel.Email,
    contactReference: 'n@e.test',
    priorSport: null,
    referralSource: null,
    motivation: null,
    communicationOptIn: true,
    consentVersion: 'consent-v2',
    readiness: CandidateReadiness.Unknown,
    restrictedNotes: null,
    status: CandidateStatus.Registered,
    waitlistPosition: null,
    retentionExpiresAt: NOW,
    createdBy: null,
    now: NOW,
  };

  it('inserts a candidate and finds by identity hash', async () => {
    const inserted = scopeReturning([CANDIDATE_ROW]);
    expect((await repository.insert(inserted.scope, newCandidate)).status).toBe(
      CandidateStatus.Registered,
    );
    const dup = scopeReturning([CANDIDATE_ROW]);
    expect(
      (await repository.findByIdentityHash(dup.scope, 'event-1', 'hash'))
        ?.candidateId,
    ).toBe('cand-1');
    const none = scopeReturning([]);
    expect(
      await repository.findByIdentityHash(none.scope, 'event-1', 'other'),
    ).toBeNull();
  });

  it('throws when a candidate write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newCandidate)).rejects.toThrow(
      /candidate write/u,
    );
  });

  it('counts seated registrants and per-status counts', async () => {
    const seated = scopeReturning([{ count: 5 }]);
    expect(await repository.countSeated(seated.scope, 'event-1')).toBe(5);
    const byStatus = scopeReturning([
      { status: 'registered', count: 3 },
      { status: 'accepted', count: 1 },
    ]);
    const counts = await repository.countByStatus(byStatus.scope, 'event-1');
    expect(counts.get('registered')).toBe(3);
  });

  it('links a membership only while unconverted', async () => {
    const linked = scopeReturning([
      { ...CANDIDATE_ROW, status: 'converted', converted_membership_id: 'm-1' },
    ]);
    expect(
      (await repository.linkMembership(linked.scope, 'cand-1', 'm-1', NOW))
        ?.status,
    ).toBe(CandidateStatus.Converted);
    expect(String(linked.run.mock.calls[0]?.[0])).toContain(
      '"converted_at" IS NULL',
    );
    const replay = scopeReturning([]);
    expect(
      await repository.linkMembership(replay.scope, 'cand-1', 'm-1', NOW),
    ).toBeNull();
  });

  it('lists expired candidates and anonymizes once', async () => {
    const expired = scopeReturning([CANDIDATE_ROW]);
    expect(
      await repository.listExpired(expired.scope, 'team-1', NOW),
    ).toHaveLength(1);
    const first = scopeReturning([CANDIDATE_ROW]);
    expect(await repository.anonymize(first.scope, 'cand-1', NOW)).toBe(true);
    expect(String(first.run.mock.calls[0]?.[0])).toContain(
      '"anonymized_at" IS NULL',
    );
    const replay = scopeReturning([]);
    expect(await repository.anonymize(replay.scope, 'cand-1', NOW)).toBe(false);
  });

  it('bounds the list and count', async () => {
    const filter = {
      eventId: 'event-1',
      status: null,
      readiness: null,
    };
    const list = scopeReturning([CANDIDATE_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 4 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      4,
    );
  });
});

describe('TryoutSelectionRepository', () => {
  const repository = new TryoutSelectionRepository();

  it('upserts an evaluation per evaluator', async () => {
    const { scope, run } = scopeReturning([EVALUATION_ROW]);
    expect(
      (
        await repository.upsertEvaluation(scope, {
          id: 'eval-1',
          teamId: 'team-1',
          candidateId: 'cand-1',
          evaluatorUserId: 'user-2',
          criteriaVersion: 'criteria-v1',
          attended: true,
          ratings: {},
          observations: null,
          privateNotes: null,
          recommendation: EvaluationRecommendation.Accept,
          status: EvaluationStatus.Submitted,
          submittedAt: NOW,
          now: NOW,
        })
      ).status,
    ).toBe(EvaluationStatus.Submitted);
    expect(String(run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
  });

  it('lists evaluations and evaluator completion', async () => {
    const evals = scopeReturning([EVALUATION_ROW]);
    expect(
      await repository.listEvaluations(evals.scope, 'cand-1'),
    ).toHaveLength(1);
    const completion = scopeReturning([
      { evaluator_user_id: 'user-2', assigned: 3, submitted: 2 },
    ]);
    expect(
      await repository.listEvaluatorCompletion(completion.scope, 'event-1'),
    ).toEqual([{ evaluatorUserId: 'user-2', assigned: 3, submitted: 2 }]);
  });

  it('inserts and resolves the latest decision', async () => {
    const inserted = scopeReturning([DECISION_ROW]);
    expect(
      (
        await repository.insertDecision(inserted.scope, {
          id: 'dec-1',
          teamId: 'team-1',
          candidateId: 'cand-1',
          decision: TryoutDecisionValue.Accept,
          reasons: 'strong',
          criteriaVersion: 'criteria-v1',
          evaluatorCount: 2,
          decidedBy: 'user-3',
          now: NOW,
        })
      ).decision,
    ).toBe(TryoutDecisionValue.Accept);
    const latest = scopeReturning([DECISION_ROW]);
    expect(
      (await repository.findLatestDecision(latest.scope, 'cand-1'))?.decisionId,
    ).toBe('dec-1');
    const none = scopeReturning([]);
    expect(
      await repository.findLatestDecision(none.scope, 'cand-9'),
    ).toBeNull();
  });

  it('manages offers and finds the live and accepted one', async () => {
    const inserted = scopeReturning([OFFER_ROW]);
    expect(
      (
        await repository.insertOffer(inserted.scope, {
          id: 'offer-1',
          teamId: 'team-1',
          candidateId: 'cand-1',
          candidateMessage: null,
          expiresAt: NOW,
          createdBy: 'user-3',
          now: NOW,
        })
      ).status,
    ).toBe(OfferStatus.Draft);
    const live = scopeReturning([OFFER_ROW]);
    expect(
      (await repository.findLiveOffer(live.scope, 'cand-1'))?.offerId,
    ).toBe('offer-1');
    const accepted = scopeReturning([{ ...OFFER_ROW, status: 'accepted' }]);
    expect(
      (await repository.findAcceptedOffer(accepted.scope, 'cand-1'))?.status,
    ).toBe(OfferStatus.Accepted);
    const applied = scopeReturning([{ ...OFFER_ROW, status: 'sent' }]);
    expect(
      (
        await repository.applyOfferStatusChange(applied.scope, {
          id: 'offer-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: OfferStatus.Sent,
          sentAt: NOW,
          respondedAt: null,
          now: NOW,
        })
      )?.status,
    ).toBe(OfferStatus.Sent);
  });

  it('reuses an existing membership and inserts a new one', async () => {
    const existing = scopeReturning([{ id: 'member-1' }]);
    expect(
      await repository.findExistingMembership(
        existing.scope,
        'team-1',
        'user-9',
      ),
    ).toBe('member-1');
    const none = scopeReturning([]);
    expect(
      await repository.findExistingMembership(none.scope, 'team-1', 'user-8'),
    ).toBeNull();
    const inserted = scopeReturning([{ id: 'member-2' }]);
    expect(
      await repository.insertMembership(inserted.scope, {
        id: 'member-2',
        teamId: 'team-1',
        seasonId: 'season-1',
        userId: 'user-8',
        createdBy: 'user-3',
        now: NOW,
      }),
    ).toBe('member-2');
  });
});
