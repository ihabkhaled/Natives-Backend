import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { AssessmentCatalogRepository } from '@modules/assessments/infrastructure/assessment-catalog.repository';
import { AssessmentScopeRepository } from '@modules/assessments/infrastructure/assessment-scope.repository';
import { PlayerAssessmentRepository } from '@modules/assessments/infrastructure/player-assessment.repository';
import { PlayerAssessmentStatus } from '@modules/assessments/model/player-assessments.enums';
import { NodeEnv } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../../src/database/migrations/1721600000000-members-schema';
import { PlatformSchema1721700000000 } from '../../src/database/migrations/1721700000000-platform-schema';
import { PracticesSchema1721800000000 } from '../../src/database/migrations/1721800000000-practices-schema';
import { PracticeRsvpSchema1721900000000 } from '../../src/database/migrations/1721900000000-practice-rsvp-schema';
import { AttendanceSchema1722000000000 } from '../../src/database/migrations/1722000000000-attendance-schema';
import { PracticeAgendasSchema1722100000000 } from '../../src/database/migrations/1722100000000-practice-agendas-schema';
import { PracticeRemindersCalendarSchema1722200000000 } from '../../src/database/migrations/1722200000000-practice-reminders-calendar-schema';
import { AssessmentCatalogSchema1722300000000 } from '../../src/database/migrations/1722300000000-assessment-catalog-schema';
import { PlayerAssessmentSchema1722400000000 } from '../../src/database/migrations/1722400000000-player-assessment-schema';
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';

const TEST_DB_CONFIG = {
  url: process.env['TEST_DATABASE_URL'],
  host: process.env['TEST_DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['TEST_DB_PORT'] ?? '55432'),
  username: process.env['TEST_DB_USERNAME'] ?? 'natives_test',
  password: process.env['TEST_DB_PASSWORD'] ?? 'natives_test',
  name: process.env['TEST_DB_NAME'] ?? 'natives_test',
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
};

const NOW = new Date('2026-06-01T12:00:00.000Z');
const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PlatformSchema1721700000000,
  PracticesSchema1721800000000,
  PracticeRsvpSchema1721900000000,
  AttendanceSchema1722000000000,
  PracticeAgendasSchema1722100000000,
  PracticeRemindersCalendarSchema1722200000000,
  AssessmentCatalogSchema1722300000000,
  PlayerAssessmentSchema1722400000000,
  PlatformLifecycleSchema1723800000000,
];

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: MIGRATIONS,
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
    return dataSource;
  } catch {
    return null;
  }
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Player assessments integration (PostgreSQL)'
  : `Player assessments integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port})`;

interface Scope {
  readonly teamId: string;
  readonly seasonId: string;
  readonly evaluatorId: string;
  readonly playerUserId: string;
  readonly membershipId: string;
  readonly templateId: string;
  readonly periodId: string;
  readonly metricId: string;
}

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const catalog = new AssessmentCatalogRepository();
  const scopes = new AssessmentScopeRepository();
  const repository = new PlayerAssessmentRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await activeDataSource.undoLastMigration();
      remaining -= 1;
    }
    await activeDataSource.destroy();
  });

  async function seedScope(): Promise<Scope> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const evaluatorId = randomUUID();
    const playerUserId = randomUUID();
    const membershipId = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active'), ($3, $4, 'user', 'active')`,
      [
        evaluatorId,
        `eval-${evaluatorId}@example.test`,
        playerUserId,
        `player-${playerUserId}@example.test`,
      ],
    );
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, 'Natives')`,
      [teamId, `team-${teamId.slice(0, 8)}`],
    );
    await activeDataSource.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on", "ends_on")
       VALUES ($1, $2, 'spring', 'Spring', '2026-01-01', '2026-06-30')`,
      [seasonId, teamId],
    );
    await activeDataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "season_id", "user_id", "status")
       VALUES ($1, $2, $3, $4, 'active')`,
      [membershipId, teamId, seasonId, playerUserId],
    );
    const metric = await activeDataSource.query(
      `SELECT "id" FROM "assessment_metric_definitions"
        WHERE "definition_key" = 'handling' AND "team_id" IS NULL`,
    );
    const category = await activeDataSource.query(
      `SELECT "id" FROM "assessment_metric_categories" WHERE "category_key" = 'technical'`,
    );
    const metricId = metric[0].id;
    const templateId = await publishTemplate(
      teamId,
      seasonId,
      evaluatorId,
      category[0].id,
      metricId,
    );
    const periodId = await openPeriod(
      teamId,
      seasonId,
      evaluatorId,
      templateId,
    );
    return {
      teamId,
      seasonId,
      evaluatorId,
      playerUserId,
      membershipId,
      templateId,
      periodId,
      metricId,
    };
  }

  async function publishTemplate(
    teamId: string,
    seasonId: string,
    userId: string,
    categoryId: string,
    metricId: string,
  ): Promise<string> {
    const templateId = randomUUID();
    await unitOfWork.runInTransaction(scope =>
      catalog.insertTemplate(
        scope,
        {
          id: templateId,
          familyId: templateId,
          teamId,
          seasonId,
          key: 'midseason',
          name: 'Midseason',
          cohort: null,
          evaluatorRoles: ['COACH'] as never,
          scoreVersion: 1,
          version: 1,
          createdBy: userId,
          now: NOW,
        },
        [{ categoryId, weightPercentage: 100 }],
        [{ metricDefinitionId: metricId, required: true, sortOrder: 0 }],
      ),
    );
    await unitOfWork.runInTransaction(scope =>
      catalog.publishTemplate(scope, {
        id: templateId,
        teamId,
        expectedRecordVersion: 1,
        publishedBy: userId,
        now: NOW,
      }),
    );
    return templateId;
  }

  async function openPeriod(
    teamId: string,
    seasonId: string,
    userId: string,
    templateId: string,
  ): Promise<string> {
    const periodId = randomUUID();
    await unitOfWork.runInTransaction(scope =>
      catalog.insertPeriod(scope, {
        id: periodId,
        teamId,
        seasonId,
        templateId,
        name: 'Q1',
        cohort: null,
        startsOn: '2026-01-01',
        endsOn: '2026-03-31',
        createdBy: userId,
        now: NOW,
      }),
    );
    return periodId;
  }

  function newDraft(seed: Scope, id: string, numericValue: number | null) {
    return {
      assessment: {
        id,
        familyId: id,
        teamId: seed.teamId,
        seasonId: seed.seasonId,
        periodId: seed.periodId,
        templateId: seed.templateId,
        membershipId: seed.membershipId,
        evaluatorUserId: seed.evaluatorId,
        status: PlayerAssessmentStatus.Draft,
        revision: 1,
        summary: 'draft',
        reviewedBy: null,
        reviewedAt: null,
        publishedBy: null,
        publishedAt: null,
        createdBy: seed.evaluatorId,
        now: NOW,
      },
      value: {
        id: randomUUID(),
        assessmentId: id,
        metricDefinitionId: seed.metricId,
        numericValue,
        textValue: null,
        note: 'observed',
        confidence: 3,
        observationCount: 2,
        now: NOW,
      },
    };
  }

  it('migrates from empty and reverses the player assessment schema', async () => {
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.player_assessments') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();
    // Two steps back: the trailing platform-lifecycle migration (a pure ALTER
    // on teams/seasons) first, then this schema, which drops its own tables.
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.player_assessments') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();
    await activeDataSource.runMigrations();
  });

  it('resolves the published template context for a period', async () => {
    const seed = await seedScope();
    const context = await unitOfWork.runInTransaction(scope =>
      repository.loadContext(scope, seed.teamId, seed.periodId),
    );
    expect(context?.templateId).toBe(seed.templateId);
    expect(context?.metrics).toEqual([
      {
        metricDefinitionId: seed.metricId,
        required: true,
        minimumValue: 0,
        maximumValue: 5,
      },
    ]);
    const missing = await unitOfWork.runInTransaction(scope =>
      repository.loadContext(scope, seed.teamId, randomUUID()),
    );
    expect(missing).toBeNull();
  });

  it('stores a NULL metric value distinctly from a measured zero', async () => {
    const nullSeed = await seedScope();
    const nullDraft = newDraft(nullSeed, randomUUID(), null);
    await unitOfWork.runInTransaction(async scope => {
      await repository.insertAssessment(scope, nullDraft.assessment);
      await repository.insertValues(scope, [nullDraft.value]);
    });
    const raw = await activeDataSource.query(
      `SELECT "numeric_value" FROM "player_assessment_metric_values"
        WHERE "assessment_id" = $1`,
      [nullDraft.assessment.id],
    );
    expect(raw[0].numeric_value).toBeNull();

    const zeroSeed = await seedScope();
    const zeroDraft = newDraft(zeroSeed, randomUUID(), 0);
    await unitOfWork.runInTransaction(async scope => {
      await repository.insertAssessment(scope, zeroDraft.assessment);
      await repository.insertValues(scope, [zeroDraft.value]);
    });
    const zero = await activeDataSource.query(
      `SELECT "numeric_value" FROM "player_assessment_metric_values"
        WHERE "assessment_id" = $1`,
      [zeroDraft.assessment.id],
    );
    expect(Number(zero[0].numeric_value)).toBe(0);
  });

  it('enforces one live assessment per evaluator, player, and period', async () => {
    const seed = await seedScope();
    const first = newDraft(seed, randomUUID(), 3);
    await unitOfWork.runInTransaction(scope =>
      repository.insertAssessment(scope, first.assessment),
    );
    expect(
      await unitOfWork.runInTransaction(scope =>
        repository.liveExists(
          scope,
          seed.periodId,
          seed.membershipId,
          seed.evaluatorId,
        ),
      ),
    ).toBe(true);
    const second = newDraft(seed, randomUUID(), 4);
    await expect(
      unitOfWork.runInTransaction(scope =>
        repository.insertAssessment(scope, second.assessment),
      ),
    ).rejects.toThrow();
  });

  it('drives the workflow and keeps a published snapshot immutable', async () => {
    const seed = await seedScope();
    const draft = newDraft(seed, randomUUID(), 4);
    const id = draft.assessment.id;
    await unitOfWork.runInTransaction(async scope => {
      await repository.insertAssessment(scope, draft.assessment);
      await repository.insertValues(scope, [draft.value]);
    });
    await transitionTo(id, seed, PlayerAssessmentStatus.Submitted, 1);
    await transitionTo(id, seed, PlayerAssessmentStatus.Approved, 2);
    const published = await transitionTo(
      id,
      seed,
      PlayerAssessmentStatus.Published,
      3,
    );
    expect(published?.status).toBe(PlayerAssessmentStatus.Published);

    await expect(
      activeDataSource.query(
        `UPDATE "player_assessments" SET "summary" = 'tampered' WHERE "id" = $1`,
        [id],
      ),
    ).rejects.toThrow(/immutable/u);
    await expect(
      activeDataSource.query(
        `UPDATE "player_assessment_metric_values" SET "numeric_value" = 1
          WHERE "assessment_id" = $1`,
        [id],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it('supersedes a published assessment with a new revision and lists own published', async () => {
    const seed = await seedScope();
    const draft = newDraft(seed, randomUUID(), 4);
    const id = draft.assessment.id;
    await unitOfWork.runInTransaction(async scope => {
      await repository.insertAssessment(scope, draft.assessment);
      await repository.insertValues(scope, [draft.value]);
    });
    await transitionTo(id, seed, PlayerAssessmentStatus.Submitted, 1);
    await transitionTo(id, seed, PlayerAssessmentStatus.Approved, 2);
    await transitionTo(id, seed, PlayerAssessmentStatus.Published, 3);

    const revisionId = randomUUID();
    await unitOfWork.runInTransaction(async scope => {
      const superseded = await repository.supersede(scope, {
        id,
        supersededById: revisionId,
        now: NOW,
      });
      expect(superseded).toBe(true);
      await repository.insertAssessment(scope, {
        ...draft.assessment,
        id: revisionId,
        familyId: draft.assessment.familyId,
        status: PlayerAssessmentStatus.Revised,
        revision: 2,
        publishedBy: seed.evaluatorId,
        publishedAt: NOW,
      });
    });

    const own = await unitOfWork.runInTransaction(scope =>
      repository.listOwnPublished(scope, seed.teamId, seed.playerUserId, {
        limit: 20,
        offset: 0,
      }),
    );
    expect(own.total).toBe(1);
    expect(own.assessments[0]?.id).toBe(revisionId);

    const revisions = await unitOfWork.runInTransaction(scope =>
      repository.listRevisions(scope, seed.teamId, draft.assessment.familyId),
    );
    expect(revisions.items).toHaveLength(2);

    const foreign = await unitOfWork.runInTransaction(scope =>
      repository.listOwnPublished(scope, seed.teamId, randomUUID(), {
        limit: 20,
        offset: 0,
      }),
    );
    expect(foreign.total).toBe(0);
  });

  it('reads details, updates drafts, and answers membership probes', async () => {
    const seed = await seedScope();
    const draft = newDraft(seed, randomUUID(), 2);
    const id = draft.assessment.id;
    await unitOfWork.runInTransaction(async scope => {
      await repository.insertAssessment(scope, draft.assessment);
      await repository.insertValues(scope, [draft.value]);
    });
    const updated = await unitOfWork.runInTransaction(async scope => {
      const applied = await repository.updateDraft(
        scope,
        id,
        seed.teamId,
        'edited summary',
        1,
        NOW,
      );
      await repository.clearValues(scope, id);
      return applied;
    });
    expect(updated?.summary).toBe('edited summary');
    expect(updated?.recordVersion).toBe(2);

    const detail = await unitOfWork.runInTransaction(scope =>
      repository.findDetail(scope, seed.teamId, id),
    );
    expect(detail?.values).toHaveLength(0);

    const page = await unitOfWork.runInTransaction(scope =>
      repository.listForTeam(scope, seed.teamId, { limit: 20, offset: 0 }),
    );
    expect(page.total).toBe(1);

    const values = await unitOfWork.runInTransaction(scope =>
      repository.valuesByAssessment(scope, [id]),
    );
    expect(values.size).toBe(0);

    const membership = await unitOfWork.runInTransaction(async scope => ({
      present: await scopes.membershipExistsInTeam(
        scope,
        seed.teamId,
        seed.membershipId,
      ),
      absent: await scopes.membershipExistsInTeam(
        scope,
        seed.teamId,
        randomUUID(),
      ),
    }));
    expect(membership).toEqual({ present: true, absent: false });

    const bounds = await unitOfWork.runInTransaction(scope =>
      repository.loadTemplateBounds(scope, seed.templateId),
    );
    expect(bounds).toHaveLength(1);
  });

  async function transitionTo(
    id: string,
    seed: Scope,
    toStatus: PlayerAssessmentStatus,
    expectedRecordVersion: number,
  ) {
    return unitOfWork.runInTransaction(scope =>
      repository.applyTransition(scope, {
        id,
        teamId: seed.teamId,
        toStatus,
        expectedRecordVersion,
        submittedAt: toStatus === PlayerAssessmentStatus.Submitted ? NOW : null,
        submittedBy:
          toStatus === PlayerAssessmentStatus.Submitted
            ? seed.evaluatorId
            : null,
        reviewedAt: toStatus === PlayerAssessmentStatus.Approved ? NOW : null,
        reviewedBy:
          toStatus === PlayerAssessmentStatus.Approved
            ? seed.evaluatorId
            : null,
        publishedAt: toStatus === PlayerAssessmentStatus.Published ? NOW : null,
        publishedBy:
          toStatus === PlayerAssessmentStatus.Published
            ? seed.evaluatorId
            : null,
        now: NOW,
      }),
    );
  }
});
