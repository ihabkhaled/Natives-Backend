import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { AssessmentCatalogRepository } from '@modules/assessments/infrastructure/assessment-catalog.repository';
import { AssessmentScopeRepository } from '@modules/assessments/infrastructure/assessment-scope.repository';
import { AssessmentDirection } from '@modules/assessments/model/assessments.enums';
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
  ? 'Assessments catalog integration (PostgreSQL)'
  : `Assessments integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const catalog = new AssessmentCatalogRepository();
  const scopes = new AssessmentScopeRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await activeDataSource.undoLastMigration();
      remaining -= 1;
    }
    await activeDataSource.destroy();
  });

  async function seedScope(): Promise<{
    teamId: string;
    seasonId: string;
    userId: string;
    categoryId: string;
    scaleId: string;
    seededMetricId: string;
  }> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const userId = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `user-${userId}@example.test`],
    );
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, $3)`,
      [teamId, `team-${teamId.slice(0, 8)}`, 'Natives'],
    );
    await activeDataSource.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on", "ends_on")
       VALUES ($1, $2, 'spring', 'Spring', '2026-01-01', '2026-06-30')`,
      [seasonId, teamId],
    );
    const category = await activeDataSource.query(
      `SELECT "id" FROM "assessment_metric_categories" WHERE "category_key" = 'technical'`,
    );
    const scale = await activeDataSource.query(
      `SELECT "id" FROM "assessment_scales" WHERE "scale_key" = 'legacy_0_5'`,
    );
    const metric = await activeDataSource.query(
      `SELECT "id" FROM "assessment_metric_definitions"
        WHERE "definition_key" = 'handling' AND "team_id" IS NULL`,
    );
    return {
      teamId,
      seasonId,
      userId,
      categoryId: category[0].id,
      scaleId: scale[0].id,
      seededMetricId: metric[0].id,
    };
  }

  function newMetric(seed: Awaited<ReturnType<typeof seedScope>>, id: string) {
    return {
      id,
      familyId: id,
      teamId: seed.teamId,
      categoryId: seed.categoryId,
      scaleId: seed.scaleId,
      key: 'team_sprint',
      name: 'Team sprint',
      definition: 'Observed acceleration.',
      direction: AssessmentDirection.HigherIsBetter,
      guidance: 'Use games; null when not observed.',
      applicability: ['player'],
      tags: ['physical'],
      version: 1,
      createdBy: seed.userId,
      now: NOW,
    };
  }

  it('migrates from empty and reverses the assessment schema', async () => {
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.assessment_templates') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.assessment_templates') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('seeds the audited categories and configurable scales idempotently', async () => {
    const categories = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "assessment_metric_categories"`,
    );
    const scales = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "assessment_scales"`,
    );
    expect(categories[0].count).toBe(7);
    expect(scales[0].count).toBe(6);

    const legacy = await activeDataSource.query(
      `SELECT "minimum_value", "maximum_value" FROM "assessment_scales"
        WHERE "scale_key" = 'legacy_0_5'`,
    );
    expect(Number(legacy[0].minimum_value)).toBe(0);
    expect(Number(legacy[0].maximum_value)).toBe(5);

    const open = await activeDataSource.query(
      `SELECT "maximum_value" FROM "assessment_scales" WHERE "scale_key" = 'count'`,
    );
    expect(open[0].maximum_value).toBeNull();
  });

  it('versions a team metric and lists only the current version', async () => {
    const seed = await seedScope();
    const v1Id = randomUUID();
    await unitOfWork.runInTransaction(scope =>
      catalog.insertMetric(scope, newMetric(seed, v1Id)),
    );
    const nextVersion = await unitOfWork.runInTransaction(scope =>
      catalog.nextMetricVersion(scope, v1Id),
    );
    expect(nextVersion).toBe(2);
    await unitOfWork.runInTransaction(scope =>
      catalog.insertMetric(scope, {
        ...newMetric(seed, randomUUID()),
        familyId: v1Id,
        version: 2,
        name: 'Team sprint v2',
      }),
    );

    const page = await unitOfWork.runInTransaction(scope =>
      catalog.listMetrics(scope, seed.teamId, { limit: 100, offset: 0 }),
    );
    const family = page.items.filter(item => item.familyId === v1Id);
    expect(family).toHaveLength(1);
    expect(family[0]?.version).toBe(2);

    const exists = await unitOfWork.runInTransaction(scope =>
      catalog.metricKeyExists(scope, seed.teamId, 'team_sprint'),
    );
    expect(exists).toBe(true);
  });

  it('enforces the used-metric immutability trigger on archive', async () => {
    const seed = await seedScope();
    const metricId = randomUUID();
    await unitOfWork.runInTransaction(scope =>
      catalog.insertMetric(scope, newMetric(seed, metricId)),
    );
    const template = await unitOfWork.runInTransaction(scope =>
      catalog.insertTemplate(
        scope,
        {
          id: randomUUID(),
          familyId: randomUUID(),
          teamId: seed.teamId,
          seasonId: null,
          key: 'midseason',
          name: 'Midseason',
          cohort: null,
          evaluatorRoles: ['COACH'] as never,
          scoreVersion: 1,
          version: 1,
          createdBy: seed.userId,
          now: NOW,
        },
        [{ categoryId: seed.categoryId, weightPercentage: 100 }],
        [{ metricDefinitionId: metricId, required: true, sortOrder: 0 }],
      ),
    );
    expect(template.categoryWeights).toHaveLength(1);

    // The BEFORE UPDATE guard trigger blocks the archive at the database; the
    // adapter surfaces it as a sanitized failure, so any rejection proves it.
    await expect(
      unitOfWork.runInTransaction(scope =>
        catalog.archiveMetric(scope, {
          id: metricId,
          teamId: seed.teamId,
          expectedRecordVersion: 1,
          archivedBy: seed.userId,
          now: NOW,
        }),
      ),
    ).rejects.toThrow();

    const raw = activeDataSource.query(
      `UPDATE "assessment_metric_definitions" SET "status" = 'archived' WHERE "id" = $1`,
      [metricId],
    );
    await expect(raw).rejects.toThrow(/immutable/u);
  });

  it('publishes a template, locks it, and refuses raw mutation', async () => {
    const seed = await seedScope();
    const templateId = randomUUID();
    await unitOfWork.runInTransaction(scope =>
      catalog.insertTemplate(
        scope,
        {
          id: templateId,
          familyId: templateId,
          teamId: seed.teamId,
          seasonId: seed.seasonId,
          key: 'endseason',
          name: 'End season',
          cohort: null,
          evaluatorRoles: ['COACH'] as never,
          scoreVersion: 1,
          version: 1,
          createdBy: seed.userId,
          now: NOW,
        },
        [{ categoryId: seed.categoryId, weightPercentage: 100 }],
        [
          {
            metricDefinitionId: seed.seededMetricId,
            required: true,
            sortOrder: 0,
          },
        ],
      ),
    );
    const published = await unitOfWork.runInTransaction(scope =>
      catalog.publishTemplate(scope, {
        id: templateId,
        teamId: seed.teamId,
        expectedRecordVersion: 1,
        publishedBy: seed.userId,
        now: NOW,
      }),
    );
    expect(published?.status).toBe('published');

    const publishedExists = await unitOfWork.runInTransaction(scope =>
      catalog.publishedTemplateExists(scope, seed.teamId, templateId),
    );
    expect(publishedExists).toBe(true);

    await expect(
      activeDataSource.query(
        `UPDATE "assessment_templates" SET "name" = 'tampered' WHERE "id" = $1`,
        [templateId],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it('opens a period and rejects a reversed date range at the database', async () => {
    const seed = await seedScope();
    const templateId = randomUUID();
    await unitOfWork.runInTransaction(scope =>
      catalog.insertTemplate(
        scope,
        {
          id: templateId,
          familyId: templateId,
          teamId: seed.teamId,
          seasonId: null,
          key: 'periodic',
          name: 'Periodic',
          cohort: null,
          evaluatorRoles: ['COACH'] as never,
          scoreVersion: 1,
          version: 1,
          createdBy: seed.userId,
          now: NOW,
        },
        [{ categoryId: seed.categoryId, weightPercentage: 100 }],
        [
          {
            metricDefinitionId: seed.seededMetricId,
            required: true,
            sortOrder: 0,
          },
        ],
      ),
    );
    const period = await unitOfWork.runInTransaction(scope =>
      catalog.insertPeriod(scope, {
        id: randomUUID(),
        teamId: seed.teamId,
        seasonId: seed.seasonId,
        templateId,
        name: 'Q1',
        cohort: null,
        startsOn: '2026-01-01',
        endsOn: '2026-03-31',
        createdBy: seed.userId,
        now: NOW,
      }),
    );
    expect(period.startsOn).toBe('2026-01-01');
    expect(period.endsOn).toBe('2026-03-31');

    await expect(
      activeDataSource.query(
        `INSERT INTO "assessment_periods"
          ("id", "team_id", "template_id", "name", "starts_on", "ends_on")
         VALUES ($1, $2, $3, 'Bad', '2026-06-30', '2026-01-01')`,
        [randomUUID(), seed.teamId, templateId],
      ),
    ).rejects.toThrow();
  });

  it('answers assessment scope existence probes', async () => {
    const seed = await seedScope();
    const result = await unitOfWork.runInTransaction(async scope => ({
      team: await scopes.activeTeamExists(scope, seed.teamId),
      missingTeam: await scopes.activeTeamExists(scope, randomUUID()),
      season: await scopes.seasonExistsInTeam(
        scope,
        seed.teamId,
        seed.seasonId,
      ),
      missingSeason: await scopes.seasonExistsInTeam(
        scope,
        seed.teamId,
        randomUUID(),
      ),
    }));
    expect(result).toEqual({
      team: true,
      missingTeam: false,
      season: true,
      missingSeason: false,
    });
  });
});
