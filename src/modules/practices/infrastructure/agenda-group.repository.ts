import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  GROUP_COLUMNS,
  GROUP_MEMBER_COLUMNS,
} from '../model/agendas.constants';
import type {
  AgendaBlockIdRow,
  AgendaCountRow,
  AgendaGroupMemberRow,
  AgendaGroupRow,
} from '../model/agendas.rows';
import type {
  AgendaGroup,
  AgendaGroupMember,
  NewAgendaGroup,
  NewAgendaGroupMember,
} from '../model/agendas.types';

/**
 * Persistence for participant groups and their member assignments. Agenda-scoped,
 * parameterized, bounded. Member assignment uses `ON CONFLICT DO NOTHING` against
 * the unique `(agenda_id, membership_id)` so a player belongs to at most one group
 * per agenda and a duplicate assign is a clean null (idempotent skip).
 */
@Injectable()
export class AgendaGroupRepository {
  async insertGroup(
    scope: TransactionScope,
    group: NewAgendaGroup,
  ): Promise<AgendaGroup> {
    const rows = await scope.run<AgendaGroupRow>(
      `INSERT INTO "practice_agenda_groups" ("id", "agenda_id", "team_id",
              "name", "color", "coach_membership_id", "position", "notes",
              "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING ${GROUP_COLUMNS}`,
      [
        group.id,
        group.agendaId,
        group.teamId,
        group.name,
        group.color,
        group.coachMembershipId,
        group.position,
        group.notes,
        group.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the group insert');
    }
    return this.toGroup(row);
  }

  async findGroupByIdInAgenda(
    scope: TransactionScope,
    agendaId: string,
    id: string,
  ): Promise<AgendaGroup | null> {
    const rows = await scope.run<AgendaGroupRow>(
      `SELECT ${GROUP_COLUMNS} FROM "practice_agenda_groups"
        WHERE "id" = $1 AND "agenda_id" = $2`,
      [id, agendaId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toGroup(row);
  }

  async listGroupsByAgenda(
    scope: TransactionScope,
    agendaId: string,
    limit: number,
  ): Promise<readonly AgendaGroup[]> {
    const rows = await scope.run<AgendaGroupRow>(
      `SELECT ${GROUP_COLUMNS} FROM "practice_agenda_groups"
        WHERE "agenda_id" = $1
        ORDER BY "position" ASC, "name" ASC, "id" ASC
        LIMIT $2`,
      [agendaId, limit],
    );
    return rows.map(row => this.toGroup(row));
  }

  async nextPosition(
    scope: TransactionScope,
    agendaId: string,
  ): Promise<number> {
    const rows = await scope.run<AgendaCountRow>(
      `SELECT COALESCE(MAX("position") + 1, 0)::int AS "count"
         FROM "practice_agenda_groups" WHERE "agenda_id" = $1`,
      [agendaId],
    );
    return rows[0]?.count ?? 0;
  }

  async removeGroup(
    scope: TransactionScope,
    agendaId: string,
    id: string,
  ): Promise<boolean> {
    const rows = await scope.run<AgendaBlockIdRow>(
      `DELETE FROM "practice_agenda_groups"
        WHERE "id" = $1 AND "agenda_id" = $2 RETURNING "id"`,
      [id, agendaId],
    );
    return rows.length > 0;
  }

  async addMember(
    scope: TransactionScope,
    member: NewAgendaGroupMember,
  ): Promise<AgendaGroupMember | null> {
    const rows = await scope.run<AgendaGroupMemberRow>(
      `INSERT INTO "practice_agenda_group_members" ("id", "group_id",
              "agenda_id", "membership_id", "created_at")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("agenda_id", "membership_id") DO NOTHING
       RETURNING ${GROUP_MEMBER_COLUMNS}`,
      [
        member.id,
        member.groupId,
        member.agendaId,
        member.membershipId,
        member.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toMember(row);
  }

  async listMembersByAgenda(
    scope: TransactionScope,
    agendaId: string,
    limit: number,
  ): Promise<readonly AgendaGroupMember[]> {
    const rows = await scope.run<AgendaGroupMemberRow>(
      `SELECT ${GROUP_MEMBER_COLUMNS} FROM "practice_agenda_group_members"
        WHERE "agenda_id" = $1
        ORDER BY "group_id" ASC, "membership_id" ASC
        LIMIT $2`,
      [agendaId, limit],
    );
    return rows.map(row => this.toMember(row));
  }

  async removeMember(
    scope: TransactionScope,
    groupId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<AgendaBlockIdRow>(
      `DELETE FROM "practice_agenda_group_members"
        WHERE "group_id" = $1 AND "membership_id" = $2 RETURNING "id"`,
      [groupId, membershipId],
    );
    return rows.length > 0;
  }

  private toGroup(row: AgendaGroupRow): AgendaGroup {
    return {
      id: row.id,
      agendaId: row.agenda_id,
      teamId: row.team_id,
      name: row.name,
      color: row.color,
      coachMembershipId: row.coach_membership_id,
      position: row.position,
      notes: row.notes,
      version: row.version,
    };
  }

  private toMember(row: AgendaGroupMemberRow): AgendaGroupMember {
    return {
      id: row.id,
      groupId: row.group_id,
      agendaId: row.agenda_id,
      membershipId: row.membership_id,
    };
  }
}
