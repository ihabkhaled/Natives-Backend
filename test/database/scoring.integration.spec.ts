import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { CalculationRuleRepository } from '@modules/scoring/infrastructure/calculation-rule.repository';
import { ScoreProjectionRepository } from '@modules/scoring/infrastructure/score-projection.repository';
import { ScoreSourceRepository } from '@modules/scoring/infrastructure/score-source.repository';
import {
  computeMembershipProjection,
  groupSourcesByMembership,
} from '@modules/scoring/lib/scoring.builders';
import {
  CalculationRuleStatus,
  ScoreCategory,
} from '@modules/scoring/model/scoring.enums';
import type {
  CalculationRule,
  ProjectionTarget,
  RuleContent,
} from '@modules/scoring/model/scoring.types';
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
import { DevelopmentSchema1722500000000 } from '../../src/database/migrations/1722500000000-development-schema';
import { SeedHistorySchema1722600000000 } from '../../src/database/migrations/1722600000000-seed-history-schema';
import { ScoringSchema1722700000000 } from '../../src/database/migrations/1722700000000-scoring-schema';

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
  DevelopmentSchema1722500000000,
  SeedHistorySchema1722600000000,
  ScoringSchema1722700000000,
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

function content(overrides: Partial<RuleContent> = {}): RuleContent {
  return {
    ruleKey: `team_overall_${randomUUID().slice(0, 8)}`,
    name: 'Team overall',
    description: null,
    seasonId: null,
    scaleMin: 0,
    scaleMax: 5,
    minComponents: 1,
    effectiveFrom: null,
    effectiveTo: null,
    components: [
      { categoryKey: ScoreCategory.Technical, weight: 1, minSample: 1 },
    ],
    ...overrides,
  };
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Scoring engine integration (PostgreSQL)'
  : `Scoring integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const rules = new CalculationRuleRepository();
  const projections = new ScoreProjectionRepository();
  const sources = new ScoreSourceRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await active.undoLastMigration();
      remaining -= 1;
    }
    await active.destroy();
  });

  async function seedScope(): Promise<{
    teamId: string;
    membershipId: string;
    userId: string;
  }> {
    const teamId = randomUUID();
    const userId = randomUUID();
    const membershipId = randomUUID();
    await active.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `user-${userId}@example.test`],
    );
    await active.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, 'Natives')`,
      [teamId, `team-${teamId.slice(0, 8)}`],
    );
    await active.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [membershipId, teamId, userId],
    );
    return { teamId, membershipId, userId };
  }

  async function seedPublishedAssessment(scope: {
    teamId: string;
    membershipId: string;
    userId: string;
  }): Promise<void> {
    const templateId = randomUUID();
    const periodId = randomUUID();
    const assessmentId = randomUUID();
    await active.query(
      `INSERT INTO "assessment_templates"
        ("id", "family_id", "team_id", "template_key", "name", "evaluator_roles",
         "score_version", "status", "template_version")
       VALUES ($1, $1, $2, 'default', 'Default', ARRAY['COACH'], 1, 'published', 1)`,
      [templateId, scope.teamId],
    );
    await active.query(
      `INSERT INTO "assessment_periods"
        ("id", "team_id", "template_id", "name", "starts_on", "ends_on")
       VALUES ($1, $2, $3, 'Q1', '2026-01-01', '2026-03-31')`,
      [periodId, scope.teamId, templateId],
    );
    await active.query(
      `INSERT INTO "player_assessments"
        ("id", "family_id", "team_id", "period_id", "template_id",
         "membership_id", "evaluator_user_id", "status")
       VALUES ($1, $1, $2, $3, $4, $5, $6, 'published')`,
      [
        assessmentId,
        scope.teamId,
        periodId,
        templateId,
        scope.membershipId,
        scope.userId,
      ],
    );
    await seedValues(assessmentId, [
      ['handling', 4],
      ['short_throws', 2],
      ['long_throws', null],
    ]);
  }

  async function seedValues(
    assessmentId: string,
    entries: readonly (readonly [string, number | null])[],
  ): Promise<void> {
    for (const [definitionKey, value] of entries) {
      const metric = await active.query(
        `SELECT "id" FROM "assessment_metric_definitions"
          WHERE "definition_key" = $1 LIMIT 1`,
        [definitionKey],
      );
      await active.query(
        `INSERT INTO "player_assessment_metric_values"
          ("id", "assessment_id", "metric_definition_id", "numeric_value")
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), assessmentId, metric[0].id, value],
      );
    }
  }

  function target(
    teamId: string,
    membershipId: string,
  ): ProjectionTarget {
    return {
      id: randomUUID(),
      teamId,
      seasonId: null,
      membershipId,
      periodId: null,
    };
  }

  async function publishedRule(teamId: string): Promise<CalculationRule> {
    return unitOfWork.runInTransaction(async tx => {
      const draft = await rules.insert(tx, {
        id: randomUUID(),
        teamId,
        version: 1,
        content: content(),
        createdBy: null as never,
        now: NOW,
      });
      const approved = await rules.applyStatusChange(tx, {
        id: draft.ruleId,
        teamId,
        expectedRecordVersion: draft.recordVersion,
        toStatus: CalculationRuleStatus.Published,
        publishedBy: null,
        publishedAt: NOW,
        retiredAt: null,
        now: NOW,
      });
      if (approved === null) {
        throw new Error('publish failed');
      }
      return approved;
    });
  }

  it('has seeded the legacy equal-weight candidate as a DRAFT', async () => {
    const rows = await active.query(
      `SELECT "status", "components" FROM "calculation_rules"
        WHERE "id" = '30300000-0000-4000-9000-000000000001'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('draft');
    expect(rows[0].components).toHaveLength(7);
  });

  it('aggregates published-assessment category values, excluding nulls', async () => {
    const scope = await seedScope();
    await seedPublishedAssessment(scope);
    const rows = await unitOfWork.runInTransaction(tx =>
      sources.categorySourcesForTeam(tx, scope.teamId),
    );
    const technical = rows.find(row => row.category_key === 'technical');
    expect(technical).toBeDefined();
    expect(technical?.total_metrics).toBe(3);
    const grouped = groupSourcesByMembership(rows);
    const source = grouped
      .get(scope.membershipId)
      ?.find(entry => entry.categoryKey === ScoreCategory.Technical);
    expect(source?.values.slice().sort()).toEqual([2, 4]);
  });

  it('rebuilds a projection idempotently — equal to a clean recompute', async () => {
    const scope = await seedScope();
    await seedPublishedAssessment(scope);
    const rule = await publishedRule(scope.teamId);
    const projection = await unitOfWork.runInTransaction(async tx => {
      const grouped = groupSourcesByMembership(
        await sources.categorySourcesForTeam(tx, scope.teamId),
      );
      const built = computeMembershipProjection(
        rule,
        target(scope.teamId, scope.membershipId),
        grouped.get(scope.membershipId) ?? [],
        NOW,
      );
      await projections.upsertReady(tx, built);
      await projections.upsertReady(tx, built);
      return built;
    });
    expect(projection.result.value).toBe(3);
    const rows = await active.query(
      `SELECT "overall_value", "source_hash", "record_version", "status"
         FROM "performance_score_projections"
        WHERE "membership_id" = $1 AND "rule_id" = $2`,
      [scope.membershipId, rule.ruleId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].overall_value)).toBe(3);
    expect(rows[0].source_hash).toBe(projection.sourceHash);
    expect(rows[0].record_version).toBe(2);
    expect(rows[0].status).toBe('ready');
  });

  it('enforces one published rule per team and rule key', async () => {
    const scope = await seedScope();
    const insertPublished = (version: number): Promise<unknown> =>
      active.query(
        `INSERT INTO "calculation_rules"
          ("id", "team_id", "rule_key", "version", "name", "status", "components")
         VALUES ($1, $2, 'unique_overall', $3, 'Overall', 'published', '[]'::jsonb)`,
        [randomUUID(), scope.teamId, version],
      );
    await insertPublished(1);
    await expect(insertPublished(2)).rejects.toThrow();
  });
});
