import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { AgendaBlockRepository } from '@modules/practices/infrastructure/agenda-block.repository';
import { AgendaGroupRepository } from '@modules/practices/infrastructure/agenda-group.repository';
import { AgendaStationRepository } from '@modules/practices/infrastructure/agenda-station.repository';
import { DrillRepository } from '@modules/practices/infrastructure/drill.repository';
import { PracticeAgendaRepository } from '@modules/practices/infrastructure/practice-agenda.repository';
import {
  AgendaBlockType,
  AgendaStatus,
  CompletionStatus,
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from '@modules/practices/model/agendas.enums';
import type {
  NewAgenda,
  NewAgendaBlock,
  NewAgendaGroup,
  NewAgendaStation,
  NewDrill,
} from '@modules/practices/model/agendas.types';
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
  ? 'Practice agendas integration (PostgreSQL)'
  : `Practice agendas integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

interface Scope {
  readonly teamId: string;
  readonly seasonId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly memberA: string;
  readonly memberB: string;
}

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const drills = new DrillRepository();
  const agendas = new PracticeAgendaRepository();
  const blocks = new AgendaBlockRepository();
  const stations = new AgendaStationRepository();
  const groups = new AgendaGroupRepository();

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
    const userId = randomUUID();
    const sessionId = randomUUID();
    const memberA = randomUUID();
    const memberB = randomUUID();
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
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `user-${userId.slice(0, 8)}@example.test`],
    );
    await activeDataSource.query(
      `INSERT INTO "practice_sessions" ("id", "team_id", "season_id",
              "session_type", "starts_at", "ends_at", "status")
       VALUES ($1, $2, $3, 'practice', $4, $5, 'published')`,
      [sessionId, teamId, seasonId, NOW.toISOString(), NOW.toISOString()],
    );
    await activeDataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active'), ($4, $2, NULL, 'active')`,
      [memberA, teamId, userId, memberB],
    );
    return { teamId, seasonId, userId, sessionId, memberA, memberB };
  }

  function newDrill(scope: Scope, name: string): NewDrill {
    return {
      id: randomUUID(),
      teamId: scope.teamId,
      seasonId: scope.seasonId,
      name,
      category: DrillCategory.Throwing,
      objective: 'flow',
      instructions: null,
      equipment: ['cones', 'discs'],
      intensity: DrillIntensity.High,
      defaultDurationMinutes: 15,
      skillTags: ['handling', 'cutting'],
      safetyNotes: null,
      mediaUrl: null,
      createdBy: scope.userId,
      now: NOW,
    };
  }

  function newAgenda(scope: Scope): NewAgenda {
    return {
      id: randomUUID(),
      sessionId: scope.sessionId,
      teamId: scope.teamId,
      seasonId: scope.seasonId,
      theme: 'defense',
      notes: null,
      createdBy: scope.userId,
      now: NOW,
    };
  }

  function newBlock(
    scope: Scope,
    agendaId: string,
    position: number,
  ): NewAgendaBlock {
    return {
      id: randomUUID(),
      agendaId,
      sessionId: scope.sessionId,
      teamId: scope.teamId,
      drillId: null,
      position,
      title: `Block ${position}`,
      blockType: AgendaBlockType.Drill,
      offsetMinutes: null,
      durationMinutes: 20,
      intensity: DrillIntensity.Moderate,
      repetitions: 3,
      target: '10 reps',
      notes: 'shared',
      coachNotes: 'private',
      createdBy: scope.userId,
      now: NOW,
    };
  }

  function newGroup(scope: Scope, agendaId: string): NewAgendaGroup {
    return {
      id: randomUUID(),
      agendaId,
      teamId: scope.teamId,
      name: 'Group A',
      color: 'red',
      coachMembershipId: scope.memberA,
      position: 0,
      notes: null,
      now: NOW,
    };
  }

  function newStation(
    scope: Scope,
    agendaId: string,
    blockId: string,
    groupId: string,
  ): NewAgendaStation {
    return {
      id: randomUUID(),
      blockId,
      agendaId,
      teamId: scope.teamId,
      drillId: null,
      groupId,
      coachMembershipId: scope.memberA,
      position: 0,
      name: 'Endzone',
      repetitions: 5,
      target: null,
      notes: null,
      now: NOW,
    };
  }

  it('migrates from empty and drops the agenda schema reversibly', async () => {
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.practice_agenda_blocks') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.practice_agenda_blocks') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('inserts, reads, filters, updates, and archives catalog drills', async () => {
    const scope = await seedScope();
    const created = await unitOfWork.runInTransaction(tx =>
      drills.insert(tx, newDrill(scope, 'Give and go')),
    );
    expect(created?.equipment).toEqual(['cones', 'discs']);

    const duplicate = await unitOfWork.runInTransaction(tx =>
      drills.insert(tx, newDrill(scope, 'Give and go')),
    );
    expect(duplicate).toBeNull();

    const listed = await unitOfWork.runInTransaction(tx =>
      drills.list(tx, scope.teamId, {
        category: DrillCategory.Throwing,
        status: DrillStatus.Active,
        skillTag: 'handling',
        limit: 20,
        offset: 0,
      }),
    );
    expect(listed).toHaveLength(1);
    const total = await unitOfWork.runInTransaction(tx =>
      drills.count(tx, scope.teamId, {
        category: null,
        status: null,
        skillTag: null,
        limit: 20,
        offset: 0,
      }),
    );
    expect(total).toBe(1);

    const stale = await unitOfWork.runInTransaction(tx =>
      drills.update(tx, {
        id: created?.id ?? '',
        name: 'Give and go v2',
        category: DrillCategory.Cutting,
        objective: null,
        instructions: null,
        equipment: [],
        intensity: DrillIntensity.Low,
        defaultDurationMinutes: null,
        skillTags: [],
        safetyNotes: null,
        mediaUrl: null,
        updatedBy: scope.userId,
        expectedVersion: 99,
        now: NOW,
      }),
    );
    expect(stale).toBeNull();

    const archived = await unitOfWork.runInTransaction(tx =>
      drills.archive(tx, scope.teamId, created?.id ?? '', scope.userId, NOW),
    );
    expect(archived?.status).toBe(DrillStatus.Archived);
    // name is free again once archived
    const reused = await unitOfWork.runInTransaction(tx =>
      drills.insert(tx, newDrill(scope, 'Give and go')),
    );
    expect(reused).not.toBeNull();
  });

  it('creates an agenda idempotently and drives its lifecycle', async () => {
    const scope = await seedScope();
    const agenda = newAgenda(scope);
    const created = await unitOfWork.runInTransaction(tx =>
      agendas.insertAgenda(tx, agenda),
    );
    expect(created?.status).toBe(AgendaStatus.Draft);
    const dup = await unitOfWork.runInTransaction(tx =>
      agendas.insertAgenda(tx, agenda),
    );
    expect(dup).toBeNull();

    const staleBump = await unitOfWork.runInTransaction(tx =>
      agendas.bumpVersion(tx, agenda.id, scope.userId, 99, NOW),
    );
    expect(staleBump).toBeNull();

    const published = await unitOfWork.runInTransaction(tx =>
      agendas.publish(tx, {
        id: agenda.id,
        actorUserId: scope.userId,
        expectedVersion: 1,
        now: NOW,
      }),
    );
    expect(published?.status).toBe(AgendaStatus.Published);
    // cannot publish twice
    const republish = await unitOfWork.runInTransaction(tx =>
      agendas.publish(tx, {
        id: agenda.id,
        actorUserId: scope.userId,
        expectedVersion: published?.version ?? 2,
        now: NOW,
      }),
    );
    expect(republish).toBeNull();

    const completed = await unitOfWork.runInTransaction(tx =>
      agendas.complete(tx, {
        id: agenda.id,
        actorUserId: scope.userId,
        expectedVersion: published?.version ?? 2,
        now: NOW,
      }),
    );
    expect(completed?.status).toBe(AgendaStatus.Completed);
  });

  it('adds, lists, reorders, updates, completes, and removes blocks', async () => {
    const scope = await seedScope();
    const agenda = newAgenda(scope);
    await unitOfWork.runInTransaction(tx => agendas.insertAgenda(tx, agenda));

    const first = newBlock(scope, agenda.id, 0);
    const second = newBlock(scope, agenda.id, 1);
    await unitOfWork.runInTransaction(tx => blocks.insert(tx, first));
    await unitOfWork.runInTransaction(tx => blocks.insert(tx, second));

    const next = await unitOfWork.runInTransaction(tx =>
      blocks.nextPosition(tx, agenda.id),
    );
    expect(next).toBe(2);

    const ids = await unitOfWork.runInTransaction(tx =>
      blocks.listIdsByAgenda(tx, agenda.id, 50),
    );
    expect(ids).toEqual([first.id, second.id]);

    await unitOfWork.runInTransaction(tx =>
      blocks.reposition(
        tx,
        agenda.id,
        [
          { id: second.id, position: 0 },
          { id: first.id, position: 1 },
        ],
        NOW,
      ),
    );
    const reordered = await unitOfWork.runInTransaction(tx =>
      blocks.listByAgenda(tx, agenda.id, 50),
    );
    expect(reordered.map(b => b.id)).toEqual([second.id, first.id]);

    const updated = await unitOfWork.runInTransaction(tx =>
      blocks.update(tx, {
        id: first.id,
        drillId: null,
        title: 'Renamed',
        blockType: AgendaBlockType.Scrimmage,
        offsetMinutes: 5,
        durationMinutes: 30,
        intensity: null,
        repetitions: null,
        target: null,
        notes: null,
        coachNotes: null,
        updatedBy: scope.userId,
        expectedVersion: 1,
        now: NOW,
      }),
    );
    expect(updated?.title).toBe('Renamed');

    const completed = await unitOfWork.runInTransaction(tx =>
      blocks.complete(tx, {
        id: first.id,
        completionStatus: CompletionStatus.Completed,
        completedBy: scope.userId,
        completedAt: NOW,
        updatedBy: scope.userId,
        expectedVersion: updated?.version ?? 2,
        now: NOW,
      }),
    );
    expect(completed?.completionStatus).toBe(CompletionStatus.Completed);

    const found = await unitOfWork.runInTransaction(tx =>
      blocks.findByIdInAgenda(tx, agenda.id, first.id),
    );
    expect(found?.id).toBe(first.id);

    const removed = await unitOfWork.runInTransaction(tx =>
      blocks.remove(tx, agenda.id, second.id),
    );
    expect(removed).toBe(true);
  });

  it('manages stations, groups, and member assignments', async () => {
    const scope = await seedScope();
    const agenda = newAgenda(scope);
    await unitOfWork.runInTransaction(tx => agendas.insertAgenda(tx, agenda));
    const block = newBlock(scope, agenda.id, 0);
    await unitOfWork.runInTransaction(tx => blocks.insert(tx, block));

    const group = newGroup(scope, agenda.id);
    const createdGroup = await unitOfWork.runInTransaction(tx =>
      groups.insertGroup(tx, group),
    );
    expect(createdGroup.name).toBe('Group A');
    const groupNext = await unitOfWork.runInTransaction(tx =>
      groups.nextPosition(tx, agenda.id),
    );
    expect(groupNext).toBe(1);

    const station = newStation(scope, agenda.id, block.id, group.id);
    const createdStation = await unitOfWork.runInTransaction(tx =>
      stations.insert(tx, station),
    );
    expect(createdStation.groupId).toBe(group.id);
    const stationNext = await unitOfWork.runInTransaction(tx =>
      stations.nextPosition(tx, block.id),
    );
    expect(stationNext).toBe(1);
    const stationList = await unitOfWork.runInTransaction(tx =>
      stations.listByAgenda(tx, agenda.id, 50),
    );
    expect(stationList).toHaveLength(1);

    const member = await unitOfWork.runInTransaction(tx =>
      groups.addMember(tx, {
        id: randomUUID(),
        groupId: group.id,
        agendaId: agenda.id,
        membershipId: scope.memberB,
        now: NOW,
      }),
    );
    expect(member?.membershipId).toBe(scope.memberB);
    // one group per member per agenda: a second assign is a clean null
    const dupMember = await unitOfWork.runInTransaction(tx =>
      groups.addMember(tx, {
        id: randomUUID(),
        groupId: group.id,
        agendaId: agenda.id,
        membershipId: scope.memberB,
        now: NOW,
      }),
    );
    expect(dupMember).toBeNull();

    const members = await unitOfWork.runInTransaction(tx =>
      groups.listMembersByAgenda(tx, agenda.id, 50),
    );
    expect(members).toHaveLength(1);
    const foundGroup = await unitOfWork.runInTransaction(tx =>
      groups.findGroupByIdInAgenda(tx, agenda.id, group.id),
    );
    expect(foundGroup?.id).toBe(group.id);
    const listedGroups = await unitOfWork.runInTransaction(tx =>
      groups.listGroupsByAgenda(tx, agenda.id, 50),
    );
    expect(listedGroups).toHaveLength(1);

    expect(
      await unitOfWork.runInTransaction(tx =>
        groups.removeMember(tx, group.id, scope.memberB),
      ),
    ).toBe(true);
    expect(
      await unitOfWork.runInTransaction(tx =>
        stations.remove(tx, block.id, station.id),
      ),
    ).toBe(true);
    expect(
      await unitOfWork.runInTransaction(tx =>
        groups.removeGroup(tx, agenda.id, group.id),
      ),
    ).toBe(true);
  });
});
