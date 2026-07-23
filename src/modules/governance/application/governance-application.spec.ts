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

import { CaseNotFoundError } from '../errors/case-not-found.error';
import { GovernanceInvalidTransitionError } from '../errors/governance-invalid-transition.error';
import { GovernanceScopeNotFoundError } from '../errors/governance-scope-not-found.error';
import { GovernanceValidationError } from '../errors/governance-validation.error';
import { GovernanceVersionConflictError } from '../errors/governance-version-conflict.error';
import { RuleAcknowledgementForbiddenError } from '../errors/rule-acknowledgement-forbidden.error';
import { RuleNotFoundError } from '../errors/rule-not-found.error';
import { SeparationOfDutiesError } from '../errors/separation-of-duties.error';
import type { DisciplineRepository } from '../infrastructure/discipline.repository';
import type { GovernanceDirectoryRepository } from '../infrastructure/governance-directory.repository';
import type { GovernanceScopeRepository } from '../infrastructure/governance-scope.repository';
import type { MeetingRepository } from '../infrastructure/meeting.repository';
import type { RuleRepository } from '../infrastructure/rule.repository';
import type { TaskRepository } from '../infrastructure/task.repository';
import {
  DisciplineAction,
  DisciplineSeverity,
  DisciplineStatus,
  DisciplineTransition,
  MeetingStatus,
  MeetingTransition,
  MeetingVisibility,
  RuleAudience,
  RuleCategory,
  RuleStatus,
  TaskPriority,
  TaskStatus,
  TaskTransition,
} from '../model/governance.enums';
import type {
  DisciplineCase,
  GovernanceMeeting,
  GovernancePosition,
  GovernanceTask,
  RuleAcknowledgement,
  TeamRule,
} from '../model/governance.types';
import { AcknowledgeRuleUseCase } from './acknowledge-rule.use-case';
import { DirectoryQueryService } from './directory-query.service';
import { DisciplineQueryService } from './discipline-query.service';
import { GovernanceAuthorityService } from './governance-authority.service';
import { GovernanceLookupService } from './governance-lookup.service';
import { ManageDirectoryUseCase } from './manage-directory.use-case';
import { ManageMeetingUseCase } from './manage-meeting.use-case';
import { ManageTaskUseCase } from './manage-task.use-case';
import { MeetingQueryService } from './meeting-query.service';
import { OpenDisciplineCaseUseCase } from './open-discipline-case.use-case';
import { PublishRuleUseCase } from './publish-rule.use-case';
import { RuleQueryService } from './rule-query.service';
import { TaskQueryService } from './task-query.service';
import { TransitionDisciplineCaseUseCase } from './transition-discipline-case.use-case';

const NOW = new Date('2025-03-01T00:00:00.000Z');
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
  email: 'admin@example.test',
  roles: [],
};
const REVIEWER: AuthUserIdentity = {
  userId: 'user-2',
  email: 'reviewer@example.test',
  roles: [],
};

const RULE: TeamRule = {
  ruleId: 'rule-1',
  teamId: 'team-1',
  ruleKey: 'conduct',
  version: 1,
  category: RuleCategory.Conduct,
  title: 'Code',
  body: 'text',
  audience: RuleAudience.Team,
  requiresAcknowledgement: true,
  effectiveFrom: NOW,
  status: RuleStatus.Active,
  ownerUserId: null,
  createdBy: 'user-1',
  archivedAt: null,
  createdAt: NOW,
};

const ACK: RuleAcknowledgement = {
  acknowledgementId: 'ack-1',
  teamId: 'team-1',
  ruleId: 'rule-1',
  membershipId: 'member-1',
  ruleVersion: 1,
  acknowledgedAt: NOW,
};

const CASE: DisciplineCase = {
  caseId: 'case-1',
  teamId: 'team-1',
  membershipId: 'member-1',
  ruleId: null,
  severity: DisciplineSeverity.Minor,
  factSummary: 'x',
  evidenceReference: null,
  privateNotes: null,
  status: DisciplineStatus.Notified,
  action: DisciplineAction.None,
  dueDate: null,
  memberResponse: null,
  appealReason: null,
  resolution: null,
  openedBy: 'user-1',
  reviewedBy: null,
  resolvedBy: null,
  recordVersion: 1,
  respondedAt: null,
  reviewedAt: null,
  appealedAt: null,
  resolvedAt: null,
  expungedAt: null,
  retentionExpiresAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const POSITION: GovernancePosition = {
  positionId: 'pos-1',
  teamId: 'team-1',
  positionKey: 'team_captain',
  title: 'Team Captain',
  responsibilities: null,
  status: 'active' as GovernancePosition['status'],
  createdBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const MEETING: GovernanceMeeting = {
  meetingId: 'meeting-1',
  teamId: 'team-1',
  title: 'Board',
  scheduledAt: NOW,
  agenda: null,
  minutes: 'confidential',
  decisions: [{ ref: 'D1', text: 'ok' }],
  visibility: MeetingVisibility.Board,
  status: MeetingStatus.Scheduled,
  recurrence: 'none' as GovernanceMeeting['recurrence'],
  recordVersion: 1,
  createdBy: 'user-1',
  minutesApprovedBy: null,
  minutesApprovedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const TASK: GovernanceTask = {
  taskId: 'task-1',
  teamId: 'team-1',
  meetingId: null,
  title: 'Book',
  description: null,
  ownerMembershipId: null,
  dueDate: null,
  priority: TaskPriority.Normal,
  status: TaskStatus.Open,
  dependsOnTaskId: null,
  recordVersion: 1,
  createdBy: 'user-1',
  completedAt: null,
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

function scopeRepo(
  overrides: Record<string, unknown> = {},
): GovernanceScopeRepository {
  return {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    membershipExists: vi.fn().mockResolvedValue(true),
    findMembership: vi
      .fn()
      .mockResolvedValue({ membershipId: 'member-1', userId: ACTOR.userId }),
    findActiveMembershipByUser: vi
      .fn()
      .mockResolvedValue({ membershipId: 'member-1', userId: ACTOR.userId }),
    ...overrides,
  };
}

function ruleRepo(overrides: Record<string, unknown> = {}): RuleRepository {
  return {
    insert: vi.fn().mockResolvedValue(RULE),
    findForWrite: vi.fn().mockResolvedValue(RULE),
    findLatestByKey: vi.fn().mockResolvedValue(RULE),
    listForScope: vi.fn().mockResolvedValue([RULE]),
    countForScope: vi.fn().mockResolvedValue(1),
    listAcknowledgementsForMembership: vi.fn().mockResolvedValue([ACK]),
    listAcknowledgementsForRule: vi.fn().mockResolvedValue([ACK]),
    countAcknowledgementsForRule: vi.fn().mockResolvedValue(1),
    upsertAcknowledgement: vi
      .fn()
      .mockResolvedValue({ acknowledgementId: 'ack-1', ruleVersion: 1 }),
    ...overrides,
  };
}

function disciplineRepo(
  overrides: Record<string, unknown> = {},
): DisciplineRepository {
  return {
    insert: vi.fn().mockResolvedValue(CASE),
    findForWrite: vi.fn().mockResolvedValue(CASE),
    applyStatusChange: vi
      .fn()
      .mockResolvedValue({ ...CASE, status: DisciplineStatus.UnderReview }),
    listForScope: vi.fn().mockResolvedValue([CASE]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as DisciplineRepository;
}

function directoryRepo(
  overrides: Record<string, unknown> = {},
): GovernanceDirectoryRepository {
  return {
    insertPosition: vi.fn().mockResolvedValue(POSITION),
    findPosition: vi.fn().mockResolvedValue(POSITION),
    listPositions: vi.fn().mockResolvedValue([POSITION]),
    countPositions: vi.fn().mockResolvedValue(1),
    endActiveAppointments: vi.fn().mockResolvedValue(undefined),
    insertAppointment: vi
      .fn()
      .mockResolvedValue({ appointmentId: 'app-1', membershipId: 'member-1' }),
    listAppointments: vi.fn().mockResolvedValue([{ appointmentId: 'app-1' }]),
    ...overrides,
  };
}

function meetingRepo(
  overrides: Record<string, unknown> = {},
): MeetingRepository {
  return {
    insert: vi.fn().mockResolvedValue(MEETING),
    findForWrite: vi.fn().mockResolvedValue(MEETING),
    applyStatusChange: vi
      .fn()
      .mockResolvedValue({ ...MEETING, status: MeetingStatus.Held }),
    listForScope: vi.fn().mockResolvedValue([MEETING]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function taskRepo(overrides: Record<string, unknown> = {}): TaskRepository {
  return {
    insert: vi.fn().mockResolvedValue(TASK),
    findForWrite: vi.fn().mockResolvedValue(TASK),
    applyStatusChange: vi
      .fn()
      .mockResolvedValue({ ...TASK, status: TaskStatus.InProgress }),
    listForScope: vi.fn().mockResolvedValue([TASK]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as TaskRepository;
}

function lookup(
  overrides: {
    scopes?: GovernanceScopeRepository;
    rules?: RuleRepository;
    discipline?: DisciplineRepository;
    directory?: GovernanceDirectoryRepository;
    meetings?: MeetingRepository;
    tasks?: TaskRepository;
  } = {},
): GovernanceLookupService {
  return new GovernanceLookupService(
    overrides.scopes ?? scopeRepo(),
    overrides.rules ?? ruleRepo(),
    overrides.discipline ?? disciplineRepo(),
    overrides.directory ?? directoryRepo(),
    overrides.meetings ?? meetingRepo(),
    overrides.tasks ?? taskRepo(),
  );
}

function permissions(keys: string[]) {
  return { resolve: vi.fn().mockResolvedValue(new Set(keys)) };
}

describe('GovernanceLookupService', () => {
  it('hides a foreign rule and validates scope', async () => {
    await expect(
      lookup({
        rules: ruleRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
      }).requireRule(TX, 'team-1', 'rule-9'),
    ).rejects.toBeInstanceOf(RuleNotFoundError);
    await expect(
      lookup({
        scopes: scopeRepo({
          activeTeamExists: vi.fn().mockResolvedValue(false),
        }),
      }).requireTeam(TX, 'team-1'),
    ).rejects.toBeInstanceOf(GovernanceScopeNotFoundError);
    await expect(
      lookup({
        scopes: scopeRepo({
          membershipExists: vi.fn().mockResolvedValue(false),
        }),
      }).requireMember(TX, 'team-1', 'member-9'),
    ).rejects.toBeInstanceOf(GovernanceScopeNotFoundError);
    await expect(
      lookup({
        discipline: disciplineRepo({
          findForWrite: vi.fn().mockResolvedValue(null),
        }),
      }).requireCase(TX, 'team-1', 'case-9'),
    ).rejects.toBeInstanceOf(CaseNotFoundError);
  });
});

describe('GovernanceAuthorityService', () => {
  it('resolves the manage and board tiers from effective permissions', async () => {
    const both = new GovernanceAuthorityService(
      permissions(['governance.manage', 'discipline.read']),
    );
    expect(await both.viewerFor(ACTOR, 'team-1')).toEqual({
      canManage: true,
      canReadBoard: true,
    });
    const reviewer = new GovernanceAuthorityService(
      permissions(['discipline.manage']),
    );
    expect(await reviewer.canReviewDiscipline(ACTOR, 'team-1')).toBe(true);
  });
});

describe('RuleQueryService', () => {
  it('returns a bounded page with the caller’s own ack state merged in', async () => {
    const service = new RuleQueryService(
      UOW,
      ruleRepo(),
      scopeRepo(),
      lookup(),
    );
    expect(
      await service.listForScope(
        'team-1',
        ACTOR,
        { category: null, status: null },
        { limit: 20, offset: 0 },
      ),
    ).toEqual({
      items: [{ ...RULE, myAcknowledgedVersion: 1, myAcknowledgedAt: NOW }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    const rule = await service.getById('team-1', ACTOR, 'rule-1');
    expect(rule.ruleId).toBe('rule-1');
    expect(rule.myAcknowledgedVersion).toBe(1);
    expect(rule.myAcknowledgedAt).toEqual(NOW);
  });

  it('reports null ack state when the caller holds no active membership', async () => {
    const service = new RuleQueryService(
      UOW,
      ruleRepo(),
      scopeRepo({
        findActiveMembershipByUser: vi.fn().mockResolvedValue(null),
      }),
      lookup(),
    );
    const page = await service.listForScope(
      'team-1',
      ACTOR,
      { category: null, status: null },
      { limit: 20, offset: 0 },
    );
    expect(page.items[0]?.myAcknowledgedVersion).toBeNull();
    expect(page.items[0]?.myAcknowledgedAt).toBeNull();
  });

  it('reports null ack state for a version the caller never acknowledged', async () => {
    const service = new RuleQueryService(
      UOW,
      ruleRepo({
        listAcknowledgementsForMembership: vi.fn().mockResolvedValue([]),
      }),
      scopeRepo(),
      lookup(),
    );
    const rule = await service.getById('team-1', ACTOR, 'rule-1');
    expect(rule.myAcknowledgedVersion).toBeNull();
  });

  it('pages one rule version’s acknowledgements for compliance', async () => {
    const service = new RuleQueryService(
      UOW,
      ruleRepo(),
      scopeRepo(),
      lookup(),
    );
    expect(
      await service.listAcknowledgements('team-1', 'rule-1', {
        limit: 20,
        offset: 0,
      }),
    ).toEqual({ items: [ACK], total: 1, limit: 20, offset: 0 });
  });

  it('404s the compliance listing of a foreign rule', async () => {
    const rules = ruleRepo({ findForWrite: vi.fn().mockResolvedValue(null) });
    const service = new RuleQueryService(
      UOW,
      rules,
      scopeRepo(),
      lookup({ rules }),
    );
    await expect(
      service.listAcknowledgements('team-1', 'rule-9', {
        limit: 20,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(RuleNotFoundError);
  });
});

describe('PublishRuleUseCase', () => {
  it('publishes the next version and enqueues the event', async () => {
    const rules = ruleRepo();
    const events = eventsStub();
    const useCase = new PublishRuleUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ rules }),
      rules,
      auditStub(),
      events,
    );
    await useCase.execute(ACTOR, 'team-1', {
      content: {
        ruleKey: 'conduct',
        category: RuleCategory.Conduct,
        title: 'Code',
        body: 'text',
        audience: RuleAudience.Team,
        requiresAcknowledgement: true,
        ownerUserId: null,
      },
    });
    expect(rules.insert).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ version: 2 }),
    );
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('starts at version 1 for a brand-new key', async () => {
    const rules = ruleRepo({
      findLatestByKey: vi.fn().mockResolvedValue(null),
    });
    const useCase = new PublishRuleUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ rules }),
      rules,
      auditStub(),
      eventsStub(),
    );
    await useCase.execute(ACTOR, 'team-1', {
      content: {
        ruleKey: 'new',
        category: RuleCategory.General,
        title: 'New',
        body: 'text',
        audience: RuleAudience.Team,
        requiresAcknowledgement: true,
        ownerUserId: null,
      },
    });
    expect(rules.insert).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ version: 1 }),
    );
  });
});

describe('AcknowledgeRuleUseCase', () => {
  it('records the acknowledgement of the current version for the actor’s own membership', async () => {
    const rules = ruleRepo();
    const useCase = new AcknowledgeRuleUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ rules }),
      rules,
      auditStub(),
    );
    expect(
      (await useCase.execute(ACTOR, 'team-1', 'rule-1', 'member-1'))
        .acknowledgementId,
    ).toBe('ack-1');
  });

  it('403s an acknowledgement on behalf of another member (BE-3)', async () => {
    const rules = ruleRepo();
    const useCase = new AcknowledgeRuleUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({
        rules,
        scopes: scopeRepo({
          findMembership: vi
            .fn()
            .mockResolvedValue({ membershipId: 'member-2', userId: 'user-9' }),
        }),
      }),
      rules,
      auditStub(),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'rule-1', 'member-2'),
    ).rejects.toBeInstanceOf(RuleAcknowledgementForbiddenError);
    expect(rules.upsertAcknowledgement).not.toHaveBeenCalled();
  });

  it('404s an acknowledgement for a membership outside the team', async () => {
    const rules = ruleRepo();
    const useCase = new AcknowledgeRuleUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({
        rules,
        scopes: scopeRepo({
          findMembership: vi.fn().mockResolvedValue(null),
        }),
      }),
      rules,
      auditStub(),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'rule-1', 'member-9'),
    ).rejects.toBeInstanceOf(GovernanceScopeNotFoundError);
  });
});

describe('DisciplineQueryService', () => {
  it('returns a bounded page and resolves one case', async () => {
    const service = new DisciplineQueryService(UOW, disciplineRepo(), lookup());
    expect(
      (
        await service.listForScope(
          'team-1',
          { membershipId: null, status: null, severity: null },
          { limit: 20, offset: 0 },
        )
      ).total,
    ).toBe(1);
    expect((await service.getById('team-1', 'case-1')).caseId).toBe('case-1');
  });
});

describe('OpenDisciplineCaseUseCase', () => {
  it('opens a case against a member with a retention deadline', async () => {
    const discipline = disciplineRepo();
    const useCase = new OpenDisciplineCaseUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ discipline }),
      discipline,
      auditStub(),
    );
    await useCase.execute(ACTOR, 'team-1', {
      content: {
        membershipId: 'member-1',
        ruleId: null,
        severity: DisciplineSeverity.Minor,
        factSummary: 'missed',
        evidenceReference: null,
        privateNotes: null,
        action: DisciplineAction.None,
        dueDate: null,
      },
    });
    expect(discipline.insert).toHaveBeenCalledTimes(1);
  });
});

describe('TransitionDisciplineCaseUseCase', () => {
  function build(discipline = disciplineRepo(), events = eventsStub()) {
    return {
      events,
      useCase: new TransitionDisciplineCaseUseCase(
        UOW,
        CLOCK,
        lookup({ discipline }),
        discipline,
        auditStub(),
        events,
      ),
    };
  }

  it('advances a case and enqueues on resolution', async () => {
    const discipline = disciplineRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue({ ...CASE, status: DisciplineStatus.UnderReview }),
      applyStatusChange: vi
        .fn()
        .mockResolvedValue({ ...CASE, status: DisciplineStatus.Resolved }),
    });
    const { useCase, events } = build(discipline);
    await useCase.execute(ACTOR, 'team-1', 'case-1', {
      transition: DisciplineTransition.Resolve,
      note: 'closed',
      action: DisciplineAction.Warning,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('refuses an illegal transition', async () => {
    const { useCase } = build(
      disciplineRepo({
        findForWrite: vi
          .fn()
          .mockResolvedValue({ ...CASE, status: DisciplineStatus.Expunged }),
      }),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'case-1', {
        transition: DisciplineTransition.Resolve,
        note: null,
        action: null,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(GovernanceInvalidTransitionError);
  });

  it('enforces separation of duties on review', async () => {
    const { useCase } = build(
      disciplineRepo({
        findForWrite: vi
          .fn()
          .mockResolvedValue({ ...CASE, openedBy: 'user-1' }),
      }),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'case-1', {
        transition: DisciplineTransition.Review,
        note: null,
        action: null,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(SeparationOfDutiesError);
  });

  it('allows a different reviewer and reports a version conflict', async () => {
    const conflict = build(
      disciplineRepo({
        findForWrite: vi
          .fn()
          .mockResolvedValue({ ...CASE, openedBy: 'user-1' }),
        applyStatusChange: vi.fn().mockResolvedValue(null),
      }),
    );
    await expect(
      conflict.useCase.execute(REVIEWER, 'team-1', 'case-1', {
        transition: DisciplineTransition.Review,
        note: null,
        action: null,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(GovernanceVersionConflictError);
  });
});

describe('DirectoryQueryService and ManageDirectoryUseCase', () => {
  it('lists positions and appointment history', async () => {
    const directory = directoryRepo();
    const service = new DirectoryQueryService(
      UOW,
      directory,
      lookup({ directory }),
    );
    expect(
      (await service.listPositions('team-1', { limit: 20, offset: 0 })).total,
    ).toBe(1);
    expect(
      (
        await service.listAppointments('team-1', 'pos-1', {
          limit: 20,
          offset: 0,
        })
      ).items,
    ).toHaveLength(1);
  });

  it('ends prior appointments before a substantive one', async () => {
    const directory = directoryRepo();
    const useCase = new ManageDirectoryUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ directory }),
      directory,
      auditStub(),
    );
    await useCase.recordAppointment(ACTOR, 'team-1', 'pos-1', {
      content: {
        membershipId: 'member-1',
        acting: false,
        startsOn: '2025-01-01',
        endsOn: null,
      },
    });
    expect(directory.endActiveAppointments).toHaveBeenCalledTimes(1);
  });

  it('keeps an acting appointment alongside the substantive holder', async () => {
    const directory = directoryRepo();
    const useCase = new ManageDirectoryUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ directory }),
      directory,
      auditStub(),
    );
    await useCase.recordAppointment(ACTOR, 'team-1', 'pos-1', {
      content: {
        membershipId: 'member-1',
        acting: true,
        startsOn: '2025-01-01',
        endsOn: null,
      },
    });
    expect(directory.endActiveAppointments).not.toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    const directory = directoryRepo();
    const useCase = new ManageDirectoryUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ directory }),
      directory,
      auditStub(),
    );
    await expect(
      useCase.recordAppointment(ACTOR, 'team-1', 'pos-1', {
        content: {
          membershipId: 'member-1',
          acting: false,
          startsOn: '2025-06-01',
          endsOn: '2025-01-01',
        },
      }),
    ).rejects.toBeInstanceOf(GovernanceValidationError);
  });

  it('creates a title', async () => {
    const directory = directoryRepo();
    const useCase = new ManageDirectoryUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ directory }),
      directory,
      auditStub(),
    );
    expect(
      (
        await useCase.createPosition(ACTOR, 'team-1', {
          content: {
            positionKey: 'team_captain',
            title: 'Team Captain',
            responsibilities: null,
          },
        })
      ).positionKey,
    ).toBe('team_captain');
  });
});

describe('MeetingQueryService and ManageMeetingUseCase', () => {
  it('redacts board minutes for a caller without the board tier', async () => {
    const meetings = meetingRepo();
    const service = new MeetingQueryService(
      UOW,
      meetings,
      lookup({ meetings }),
      new GovernanceAuthorityService(permissions([])),
    );
    const page = await service.listForScope(
      ACTOR,
      'team-1',
      { status: null, visibility: null },
      { limit: 20, offset: 0 },
    );
    expect(page.items).toEqual([]);
  });

  it('shows the full meeting to a manager', async () => {
    const meetings = meetingRepo();
    const service = new MeetingQueryService(
      UOW,
      meetings,
      lookup({ meetings }),
      new GovernanceAuthorityService(permissions(['governance.manage'])),
    );
    const meeting = await service.getById(ACTOR, 'team-1', 'meeting-1');
    expect(meeting.minutes).toBe('confidential');
  });

  it('creates and transitions a meeting', async () => {
    const meetings = meetingRepo();
    const useCase = new ManageMeetingUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ meetings }),
      meetings,
      auditStub(),
    );
    expect(
      (
        await useCase.create(ACTOR, 'team-1', {
          content: {
            title: 'Board',
            scheduledAt: NOW.toISOString(),
            agenda: null,
            visibility: MeetingVisibility.Board,
            recurrence: 'none' as GovernanceMeeting['recurrence'],
          },
        })
      ).meetingId,
    ).toBe('meeting-1');
    expect(
      (
        await useCase.transition(ACTOR, 'team-1', 'meeting-1', {
          transition: MeetingTransition.Hold,
          minutes: null,
          decisions: [],
          expectedRecordVersion: 1,
        })
      ).status,
    ).toBe(MeetingStatus.Held);
  });

  it('reports a meeting version conflict', async () => {
    const meetings = meetingRepo({
      applyStatusChange: vi.fn().mockResolvedValue(null),
    });
    const useCase = new ManageMeetingUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ meetings }),
      meetings,
      auditStub(),
    );
    await expect(
      useCase.transition(ACTOR, 'team-1', 'meeting-1', {
        transition: MeetingTransition.Hold,
        minutes: null,
        decisions: [],
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(GovernanceVersionConflictError);
  });
});

describe('TaskQueryService and ManageTaskUseCase', () => {
  it('returns a bounded page and resolves one task', async () => {
    const service = new TaskQueryService(UOW, taskRepo(), lookup());
    expect(
      (
        await service.listForScope(
          'team-1',
          { status: null, ownerMembershipId: null, meetingId: null },
          { limit: 20, offset: 0 },
        )
      ).total,
    ).toBe(1);
    expect((await service.getById('team-1', 'task-1')).taskId).toBe('task-1');
  });

  it('creates, reassigns, and refuses an illegal transition', async () => {
    const tasks = taskRepo();
    const useCase = new ManageTaskUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ tasks }),
      tasks,
      auditStub(),
    );
    await useCase.create(ACTOR, 'team-1', {
      content: {
        meetingId: null,
        title: 'Book',
        description: null,
        ownerMembershipId: 'member-1',
        dueDate: null,
        priority: TaskPriority.Normal,
        dependsOnTaskId: null,
      },
    });
    expect(tasks.insert).toHaveBeenCalledTimes(1);
    await useCase.transition(ACTOR, 'team-1', 'task-1', {
      transition: TaskTransition.Start,
      ownerMembershipId: 'member-2',
      expectedRecordVersion: 1,
    });
    const blocked = new ManageTaskUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({
        tasks: taskRepo({
          findForWrite: vi
            .fn()
            .mockResolvedValue({ ...TASK, status: TaskStatus.Cancelled }),
        }),
      }),
      taskRepo({
        findForWrite: vi
          .fn()
          .mockResolvedValue({ ...TASK, status: TaskStatus.Cancelled }),
      }),
      auditStub(),
    );
    await expect(
      blocked.transition(ACTOR, 'team-1', 'task-1', {
        transition: TaskTransition.Start,
        ownerMembershipId: null,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(GovernanceInvalidTransitionError);
  });
});
