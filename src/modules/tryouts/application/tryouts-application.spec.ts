import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { TryoutAlreadyConvertedError } from '../errors/tryout-already-converted.error';
import { TryoutConsentError } from '../errors/tryout-consent.error';
import { TryoutDecisionRequiredError } from '../errors/tryout-decision-required.error';
import { TryoutDuplicateError } from '../errors/tryout-duplicate.error';
import { TryoutEventNotFoundError } from '../errors/tryout-event-not-found.error';
import { TryoutInvalidTransitionError } from '../errors/tryout-invalid-transition.error';
import { TryoutRegistrationRefusedError } from '../errors/tryout-registration-refused.error';
import type { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import type { TryoutEventRepository } from '../infrastructure/tryout-event.repository';
import type { TryoutSelectionRepository } from '../infrastructure/tryout-selection.repository';
import {
  CandidateReadiness,
  CandidateStatus,
  ContactChannel,
  EvaluationRecommendation,
  OfferStatus,
  OfferTransition,
  TryoutDecisionValue,
  TryoutEventStatus,
  TryoutEventTransition,
  TryoutVisibility,
} from '../model/tryouts.enums';
import type {
  TryoutCandidate,
  TryoutEvent,
  TryoutOffer,
} from '../model/tryouts.types';
import { ConvertCandidateUseCase } from './convert-candidate.use-case';
import { ManageCandidateUseCase } from './manage-candidate.use-case';
import { ManageOfferUseCase } from './manage-offer.use-case';
import { ManageTryoutEventUseCase } from './manage-tryout-event.use-case';
import { RecordDecisionUseCase } from './record-decision.use-case';
import { RegisterCandidateUseCase } from './register-candidate.use-case';
import { SubmitEvaluationUseCase } from './submit-evaluation.use-case';
import { TryoutFunnelService } from './tryout-funnel.service';
import { TryoutLookupService } from './tryout-lookup.service';
import { TryoutQueryService } from './tryout-query.service';

const NOW = new Date('2025-03-10T12:00:00.000Z');
const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const CLOCK: ClockPort = { now: () => NOW, uptime: () => 0 };
let counter = 0;
const IDS: IdGeneratorPort = {
  generate: () => {
    counter += 1;
    return `generated-${counter}`;
  },
};
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'coach@example.test',
  roles: [],
};

const EVENT: TryoutEvent = {
  eventId: 'event-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  venueId: null,
  name: 'Spring',
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
};

const CANDIDATE: TryoutCandidate = {
  candidateId: 'cand-1',
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
  consentedAt: NOW,
  readiness: CandidateReadiness.Unknown,
  restrictedNotes: 'ankle',
  status: CandidateStatus.Registered,
  waitlistPosition: null,
  checkedInAt: null,
  withdrawnAt: null,
  duplicateOfCandidateId: null,
  convertedMembershipId: null,
  convertedAt: null,
  retentionExpiresAt: NOW,
  anonymizedAt: null,
  recordVersion: 1,
  createdBy: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const OFFER: TryoutOffer = {
  offerId: 'offer-1',
  teamId: 'team-1',
  candidateId: 'cand-1',
  status: OfferStatus.Draft,
  candidateMessage: null,
  expiresAt: new Date('2025-03-24T12:00:00.000Z'),
  sentAt: null,
  respondedAt: null,
  recordVersion: 1,
  createdBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
};

function auditStub(): AuditRecorderService {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorderService;
}

function eventsStub(): RecordDomainEventService {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as RecordDomainEventService;
}

function eventRepo(
  overrides: Record<string, unknown> = {},
): TryoutEventRepository {
  return {
    insert: vi.fn().mockResolvedValue(EVENT),
    findForWrite: vi.fn().mockResolvedValue(EVENT),
    applyStatusChange: vi.fn().mockResolvedValue(EVENT),
    listForTeam: vi.fn().mockResolvedValue([EVENT]),
    countForTeam: vi.fn().mockResolvedValue(1),
    activeTeamExists: vi.fn().mockResolvedValue(true),
    seasonExistsInTeam: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as TryoutEventRepository;
}

function candidateRepo(
  overrides: Record<string, unknown> = {},
): TryoutCandidateRepository {
  return {
    insert: vi.fn().mockResolvedValue(CANDIDATE),
    findForWrite: vi.fn().mockResolvedValue(CANDIDATE),
    findByIdentityHash: vi.fn().mockResolvedValue(null),
    countSeated: vi.fn().mockResolvedValue(0),
    applyStatusChange: vi.fn().mockResolvedValue(CANDIDATE),
    linkMembership: vi.fn().mockResolvedValue({
      ...CANDIDATE,
      status: CandidateStatus.Converted,
      convertedMembershipId: 'member-1',
    }),
    listForScope: vi.fn().mockResolvedValue([CANDIDATE]),
    countForScope: vi.fn().mockResolvedValue(1),
    countByStatus: vi.fn().mockResolvedValue(new Map([['registered', 1]])),
    listExpired: vi.fn().mockResolvedValue([CANDIDATE]),
    anonymize: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as TryoutCandidateRepository;
}

function selectionRepo(
  overrides: Record<string, unknown> = {},
): TryoutSelectionRepository {
  return {
    upsertEvaluation: vi.fn().mockResolvedValue({ evaluationId: 'eval-1' }),
    listEvaluations: vi.fn().mockResolvedValue([]),
    listEvaluatorCompletion: vi.fn().mockResolvedValue([]),
    insertDecision: vi.fn().mockResolvedValue({ decisionId: 'dec-1' }),
    findLatestDecision: vi.fn().mockResolvedValue(null),
    insertOffer: vi.fn().mockResolvedValue(OFFER),
    findLiveOffer: vi.fn().mockResolvedValue(null),
    findAcceptedOffer: vi
      .fn()
      .mockResolvedValue({ ...OFFER, status: OfferStatus.Accepted }),
    applyOfferStatusChange: vi
      .fn()
      .mockResolvedValue({ ...OFFER, status: OfferStatus.Sent }),
    findExistingMembership: vi.fn().mockResolvedValue(null),
    insertMembership: vi.fn().mockResolvedValue('member-1'),
    ...overrides,
  };
}

function permissions(keys: string[]) {
  return { resolve: vi.fn().mockResolvedValue(new Set(keys)) };
}

function lookup(
  events = eventRepo(),
  candidates = candidateRepo(),
): TryoutLookupService {
  return new TryoutLookupService(events, candidates);
}

describe('TryoutLookupService', () => {
  it('hides a foreign event and validates scope', async () => {
    const service = lookup(
      eventRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
    );
    await expect(
      service.requireEvent(TX, 'team-1', 'event-9'),
    ).rejects.toBeInstanceOf(TryoutEventNotFoundError);
    await expect(
      lookup().requireScope(TX, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
  });
});

describe('TryoutQueryService', () => {
  function build(keys: string[]) {
    const candidates = candidateRepo();
    return new TryoutQueryService(
      UOW,
      permissions(keys),
      eventRepo(),
      candidates,
      lookup(eventRepo(), candidates),
    );
  }

  it('redacts contacts and readiness without the tiers', async () => {
    const page = await build(['tryout.manage']).listCandidates(
      ACTOR,
      'team-1',
      { eventId: null, status: null, readiness: null },
      { limit: 20, offset: 0 },
    );
    expect(page.items[0]?.contactReference).toBeNull();
    expect(page.items[0]?.restrictedNotes).toBeNull();
  });

  it('reveals restricted fields with both tiers', async () => {
    const candidate = await build([
      'tryout.manage',
      'tryout.contacts.read',
      'tryout.readiness.read',
    ]).getCandidate(ACTOR, 'team-1', 'cand-1');
    expect(candidate.contactReference).toBe('n@e.test');
    expect(candidate.restrictedNotes).toBe('ankle');
  });

  it('lists events in a bounded page', async () => {
    expect(
      await build(['tryout.manage']).listEvents('team-1', {
        limit: 20,
        offset: 0,
      }),
    ).toEqual({ items: [EVENT], total: 1, limit: 20, offset: 0 });
  });
});

describe('TryoutFunnelService', () => {
  it('returns per-status counts and evaluator completion only', async () => {
    const candidates = candidateRepo();
    const selection = selectionRepo({
      listEvaluatorCompletion: vi
        .fn()
        .mockResolvedValue([
          { evaluatorUserId: 'user-2', assigned: 3, submitted: 2 },
        ]),
    });
    const funnel = new TryoutFunnelService(
      UOW,
      candidates,
      selection,
      lookup(eventRepo(), candidates),
    );
    const report = await funnel.forEvent('team-1', 'event-1');
    expect(report.registered).toBe(1);
    expect(report.evaluators).toHaveLength(1);
    expect(report).not.toHaveProperty('names');
  });
});

describe('ManageTryoutEventUseCase', () => {
  function build(events = eventRepo()) {
    return new ManageTryoutEventUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(events),
      events,
      auditStub(),
    );
  }

  it('creates a draft and audits it', async () => {
    const events = eventRepo();
    const created = await build(events).create(ACTOR, 'team-1', {
      content: {
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
      },
    });
    expect(created.eventId).toBe('event-1');
  });

  it('refuses an illegal event transition', async () => {
    const events = eventRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...EVENT, status: TryoutEventStatus.Completed }),
    });
    await expect(
      build(events).transition(ACTOR, 'team-1', 'event-1', {
        transition: TryoutEventTransition.Open,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(TryoutInvalidTransitionError);
  });
});

describe('RegisterCandidateUseCase', () => {
  function build(events = eventRepo(), candidates = candidateRepo()) {
    return new RegisterCandidateUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(events, candidates),
      candidates,
      auditStub(),
    );
  }

  const content = {
    content: {
      eventId: 'event-1',
      displayName: 'Nour',
      contactChannel: ContactChannel.Email,
      contactReference: 'n@e.test',
      priorSport: null,
      referralSource: null,
      motivation: null,
      communicationOptIn: false,
      consentVersion: 'consent-v2',
      readiness: CandidateReadiness.Unknown,
      restrictedNotes: null,
    },
  };

  it('registers a candidate inside the window', async () => {
    const candidates = candidateRepo();
    const candidate = await build(eventRepo(), candidates).execute(
      ACTOR,
      'team-1',
      content,
    );
    expect(candidate.candidateId).toBe('cand-1');
    expect(candidates.insert).toHaveBeenCalledTimes(1);
  });

  it('refuses an outdated consent version', async () => {
    await expect(
      build().execute(ACTOR, 'team-1', {
        content: { ...content.content, consentVersion: 'consent-v1' },
      }),
    ).rejects.toBeInstanceOf(TryoutConsentError);
  });

  it('refuses a registration when the event is not open', async () => {
    const events = eventRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...EVENT, status: TryoutEventStatus.Draft }),
    });
    await expect(
      build(events).execute(ACTOR, 'team-1', content),
    ).rejects.toBeInstanceOf(TryoutRegistrationRefusedError);
  });

  it('rejects a duplicate registrant', async () => {
    const candidates = candidateRepo({
      findByIdentityHash: vi.fn().mockResolvedValue(CANDIDATE),
    });
    await expect(
      build(eventRepo(), candidates).execute(ACTOR, 'team-1', content),
    ).rejects.toBeInstanceOf(TryoutDuplicateError);
  });
});

describe('ManageCandidateUseCase', () => {
  function build(candidates = candidateRepo()) {
    return new ManageCandidateUseCase(
      UOW,
      CLOCK,
      lookup(eventRepo(), candidates),
      candidates,
      auditStub(),
    );
  }

  it('checks a candidate in', async () => {
    const candidates = candidateRepo({
      applyStatusChange: vi
        .fn()
        .mockResolvedValue({ ...CANDIDATE, status: CandidateStatus.CheckedIn }),
    });
    expect(
      (await build(candidates).checkIn(ACTOR, 'team-1', 'cand-1', 1)).status,
    ).toBe(CandidateStatus.CheckedIn);
  });

  it('anonymizes expired candidates and reports the sweep', async () => {
    const candidates = candidateRepo();
    const report = await build(candidates).runRetention(ACTOR, 'team-1');
    expect(report.examined).toBe(1);
    expect(report.anonymized).toBe(1);
    expect(candidates.anonymize).toHaveBeenCalledTimes(1);
  });
});

describe('SubmitEvaluationUseCase', () => {
  it('records one evaluator’s original and aggregates', async () => {
    const selection = selectionRepo();
    const useCase = new SubmitEvaluationUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(),
      selection,
      auditStub(),
    );
    await useCase.execute(ACTOR, 'team-1', 'cand-1', {
      content: {
        criteriaVersion: 'criteria-v1',
        attended: true,
        ratings: { throwing: 4 },
        observations: null,
        privateNotes: 'private',
        recommendation: EvaluationRecommendation.Accept,
        submit: true,
      },
    });
    expect(selection.upsertEvaluation).toHaveBeenCalledTimes(1);
    const aggregate = await useCase.aggregate('team-1', 'cand-1');
    expect(aggregate).not.toHaveProperty('recommendation');
  });
});

describe('RecordDecisionUseCase', () => {
  function build(candidates = candidateRepo(), selection = selectionRepo()) {
    return new RecordDecisionUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(eventRepo(), candidates),
      candidates,
      selection,
      auditStub(),
    );
  }

  it('records a human decision and moves the candidate', async () => {
    const candidates = candidateRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CANDIDATE, status: CandidateStatus.CheckedIn }),
      applyStatusChange: vi
        .fn()
        .mockResolvedValue({ ...CANDIDATE, status: CandidateStatus.Accepted }),
    });
    const decision = await build(candidates).execute(
      ACTOR,
      'team-1',
      'cand-1',
      {
        decision: TryoutDecisionValue.Accept,
        reasons: 'strong',
        criteriaVersion: 'criteria-v1',
        expectedRecordVersion: 1,
      },
    );
    expect(decision.decisionId).toBe('dec-1');
  });

  it('refuses a decision the candidate lifecycle forbids', async () => {
    const candidates = candidateRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CANDIDATE, status: CandidateStatus.Converted }),
    });
    await expect(
      build(candidates).execute(ACTOR, 'team-1', 'cand-1', {
        decision: TryoutDecisionValue.Accept,
        reasons: 'strong',
        criteriaVersion: 'criteria-v1',
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(TryoutInvalidTransitionError);
  });
});

describe('ManageOfferUseCase', () => {
  function build(candidates = candidateRepo(), selection = selectionRepo()) {
    return new ManageOfferUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(eventRepo(), candidates),
      selection,
      auditStub(),
      eventsStub(),
    );
  }

  it('creates and sends a fresh offer, emitting the sent event', async () => {
    const selection = selectionRepo();
    const events = eventsStub();
    const useCase = new ManageOfferUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(),
      selection,
      auditStub(),
      events,
    );
    const offer = await useCase.execute(ACTOR, 'team-1', 'cand-1', {
      transition: OfferTransition.Send,
      candidateMessage: 'welcome',
      expectedRecordVersion: 1,
    });
    expect(offer.status).toBe(OfferStatus.Sent);
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('refuses to accept an expired offer', async () => {
    const selection = selectionRepo({
      findLiveOffer: vi.fn().mockResolvedValue({
        ...OFFER,
        status: OfferStatus.Sent,
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    });
    await expect(
      build(candidateRepo(), selection).execute(ACTOR, 'team-1', 'cand-1', {
        transition: OfferTransition.Accept,
        candidateMessage: null,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(TryoutInvalidTransitionError);
  });
});

describe('ConvertCandidateUseCase', () => {
  function build(candidates = candidateRepo(), selection = selectionRepo()) {
    return new ConvertCandidateUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(eventRepo(), candidates),
      candidates,
      selection,
      auditStub(),
      eventsStub(),
    );
  }

  const command = {
    seasonId: 'season-1',
    userId: 'user-9',
    expectedRecordVersion: 1,
  };

  it('converts an accepted candidate exactly once', async () => {
    const candidates = candidateRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CANDIDATE, status: CandidateStatus.Accepted }),
    });
    const result = await build(candidates).execute(
      ACTOR,
      'team-1',
      'cand-1',
      command,
    );
    expect(result.created).toBe(true);
    expect(result.membershipId).toBe('member-1');
  });

  it('replays a prior conversion without creating a second membership', async () => {
    const candidates = candidateRepo({
      findForWrite: vi.fn().mockResolvedValue({
        ...CANDIDATE,
        status: CandidateStatus.Converted,
        convertedMembershipId: 'member-1',
      }),
    });
    const result = await build(candidates).execute(
      ACTOR,
      'team-1',
      'cand-1',
      command,
    );
    expect(result.created).toBe(false);
    expect(result.membershipId).toBe('member-1');
  });

  it('reuses an existing membership for a returning user', async () => {
    const candidates = candidateRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CANDIDATE, status: CandidateStatus.Accepted }),
    });
    const selection = selectionRepo({
      findExistingMembership: vi.fn().mockResolvedValue('existing-1'),
    });
    const result = await build(candidates, selection).execute(
      ACTOR,
      'team-1',
      'cand-1',
      command,
    );
    expect(selection.insertMembership).not.toHaveBeenCalled();
    expect(result.membershipId).toBe('existing-1');
  });

  it('requires a human decision and an accepted offer', async () => {
    const selection = selectionRepo({
      findAcceptedOffer: vi.fn().mockResolvedValue(null),
    });
    const candidates = candidateRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CANDIDATE, status: CandidateStatus.Accepted }),
    });
    await expect(
      build(candidates, selection).execute(ACTOR, 'team-1', 'cand-1', command),
    ).rejects.toBeInstanceOf(TryoutDecisionRequiredError);
  });

  it('reports a converted candidate with no membership as an error', async () => {
    const candidates = candidateRepo({
      findForWrite: vi.fn().mockResolvedValue({
        ...CANDIDATE,
        status: CandidateStatus.Converted,
        convertedMembershipId: null,
      }),
    });
    await expect(
      build(candidates).execute(ACTOR, 'team-1', 'cand-1', command),
    ).rejects.toBeInstanceOf(TryoutAlreadyConvertedError);
  });
});
