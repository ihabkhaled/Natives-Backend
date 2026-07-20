import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDate, toNullableDate } from '../lib/rbac.helpers';
import {
  RBAC_ACTIVE_USER_STATUS,
  RBAC_ROLE_CATALOG_MAX,
} from '../model/rbac.constants';
import { GrantEffect } from '../model/rbac.enums';
import type {
  AffectedRow,
  PermissionGrantRow,
  PermissionKeyRow,
  PolicyVersionRow,
  RoleAssignmentRow,
  RoleCatalogRow,
  RoleRow,
} from '../model/rbac.rows';
import type {
  NewRbacAuditEvent,
  NewRoleAssignment,
  PermissionGrant,
  RbacRoleRecord,
  RoleAssignment,
} from '../model/rbac.types';

/**
 * Persistence for the RBAC aggregate. Data access only: parameterized SQL run
 * through the caller's transaction scope, mapping snake_case rows into vendor-free
 * domain types. Static column lists, bounded reads, no interpolation.
 */
@Injectable()
export class RbacRepository {
  async isUserActive(
    scope: TransactionScope,
    userId: string,
  ): Promise<boolean> {
    const rows = await scope.run<AffectedRow>(
      `SELECT "id" FROM "users"
        WHERE "id" = $1 AND "status" = $2 AND "deleted_at" IS NULL`,
      [userId, RBAC_ACTIVE_USER_STATUS],
    );
    return rows.length > 0;
  }

  async currentPolicyVersion(scope: TransactionScope): Promise<number> {
    const rows = await scope.run<PolicyVersionRow>(
      `SELECT "version" FROM "rbac_policy_version" WHERE "singleton" = true`,
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('RBAC policy version row is missing');
    }
    return row.version;
  }

  async bumpPolicyVersion(scope: TransactionScope, now: Date): Promise<void> {
    await scope.run(
      `UPDATE "rbac_policy_version"
          SET "version" = "version" + 1, "updated_at" = $1
        WHERE "singleton" = true`,
      [now.toISOString()],
    );
  }

  async loadAssignmentGrants(
    scope: TransactionScope,
    userId: string,
  ): Promise<readonly PermissionGrant[]> {
    const rows = await scope.run<PermissionGrantRow>(
      `SELECT p."key" AS "permission", a."team_id", a."season_id",
              a."effective_from", a."effective_to"
         FROM "user_role_assignments" a
         JOIN "role_permissions" rp ON rp."role_id" = a."role_id"
         JOIN "permissions" p ON p."id" = rp."permission_id"
        WHERE a."user_id" = $1 AND a."revoked_at" IS NULL`,
      [userId],
    );
    return rows.map(row => this.toGrant(row));
  }

  async findRoleByKey(
    scope: TransactionScope,
    key: string,
  ): Promise<RbacRoleRecord | null> {
    const rows = await scope.run<RoleRow>(
      `SELECT "id", "key" FROM "roles" WHERE "key" = $1`,
      [key],
    );
    const row = rows[0];
    return row === undefined ? null : { id: row.id, key: row.key };
  }

  async loadRolePermissions(
    scope: TransactionScope,
    roleId: string,
  ): Promise<readonly string[]> {
    const rows = await scope.run<PermissionKeyRow>(
      `SELECT p."key" FROM "role_permissions" rp
         JOIN "permissions" p ON p."id" = rp."permission_id"
        WHERE rp."role_id" = $1`,
      [roleId],
    );
    return rows.map(row => row.key);
  }

  async listRoleCatalog(
    scope: TransactionScope,
  ): Promise<readonly RoleCatalogRow[]> {
    return scope.run<RoleCatalogRow>(
      `SELECT r."key" AS "role_key", p."key" AS "permission_key"
         FROM "roles" r
         JOIN "role_permissions" rp ON rp."role_id" = r."id"
         JOIN "permissions" p ON p."id" = rp."permission_id"
        ORDER BY r."key" ASC, p."key" ASC
        LIMIT $1`,
      [RBAC_ROLE_CATALOG_MAX],
    );
  }

  async listActiveTeamAssignments(
    scope: TransactionScope,
    userId: string,
    teamId: string,
  ): Promise<readonly RoleAssignment[]> {
    const rows = await scope.run<RoleAssignmentRow>(
      `SELECT a."id", a."user_id", a."role_id", r."key" AS "role_key",
              a."team_id", a."season_id", a."effective_from", a."effective_to",
              a."granted_by", a."revoked_at", a."created_at", a."version"
         FROM "user_role_assignments" a
         JOIN "roles" r ON r."id" = a."role_id"
        WHERE a."user_id" = $1 AND a."team_id" = $2 AND a."revoked_at" IS NULL
        ORDER BY r."key" ASC, a."created_at" ASC, a."id" ASC`,
      [userId, teamId],
    );
    return rows.map(row => this.toAssignment(row, row.role_key));
  }

  async insertAssignment(
    scope: TransactionScope,
    assignment: NewRoleAssignment,
  ): Promise<RoleAssignment> {
    const rows = await scope.run<RoleAssignmentRow>(
      `INSERT INTO "user_role_assignments"
         ("id", "user_id", "role_id", "team_id", "season_id",
          "effective_from", "effective_to", "granted_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING "id", "user_id", "role_id", "team_id", "season_id",
                 "effective_from", "effective_to", "granted_by", "revoked_at",
                 "created_at", "version"`,
      [
        assignment.id,
        assignment.userId,
        assignment.roleId,
        assignment.teamId,
        assignment.seasonId,
        assignment.effectiveFrom.toISOString(),
        assignment.effectiveTo === null
          ? null
          : assignment.effectiveTo.toISOString(),
        assignment.grantedBy,
        assignment.effectiveFrom.toISOString(),
      ],
    );
    return this.toAssignment(this.requireRow(rows), assignment.roleKey);
  }

  async findActiveAssignmentById(
    scope: TransactionScope,
    id: string,
  ): Promise<RoleAssignment | null> {
    const rows = await scope.run<RoleAssignmentRow>(
      `SELECT a."id", a."user_id", a."role_id", r."key" AS "role_key",
              a."team_id", a."season_id", a."effective_from", a."effective_to",
              a."granted_by", a."revoked_at", a."created_at", a."version"
         FROM "user_role_assignments" a
         JOIN "roles" r ON r."id" = a."role_id"
        WHERE a."id" = $1 AND a."revoked_at" IS NULL`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAssignment(row, row.role_key);
  }

  async revokeAssignment(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await scope.run<AffectedRow>(
      `UPDATE "user_role_assignments"
          SET "revoked_at" = $2, "updated_at" = $2, "version" = "version" + 1
        WHERE "id" = $1 AND "revoked_at" IS NULL
       RETURNING "id"`,
      [id, now.toISOString()],
    );
    return rows.length > 0;
  }

  async listActiveAssignmentsForUser(
    scope: TransactionScope,
    userId: string,
  ): Promise<readonly RoleAssignment[]> {
    const rows = await scope.run<RoleAssignmentRow>(
      `SELECT a."id", a."user_id", a."role_id", r."key" AS "role_key",
              a."team_id", a."season_id", a."effective_from", a."effective_to",
              a."granted_by", a."revoked_at", a."created_at", a."version"
         FROM "user_role_assignments" a
         JOIN "roles" r ON r."id" = a."role_id"
        WHERE a."user_id" = $1 AND a."revoked_at" IS NULL
        ORDER BY a."created_at" ASC, a."id" ASC`,
      [userId],
    );
    return rows.map(row => this.toAssignment(row, row.role_key));
  }

  async appendAuditEvent(
    scope: TransactionScope,
    event: NewRbacAuditEvent,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "security_events" ("id", "event_type", "actor_user_id",
                                      "context", "occurred_at")
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [
        event.id,
        event.eventType,
        event.actorUserId,
        JSON.stringify(event.context),
        event.occurredAt.toISOString(),
      ],
    );
  }

  private requireRow(rows: readonly RoleAssignmentRow[]): RoleAssignmentRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the assignment write');
    }
    return row;
  }

  private toGrant(row: PermissionGrantRow): PermissionGrant {
    return {
      permission: row.permission,
      effect: GrantEffect.Allow,
      teamId: row.team_id,
      seasonId: row.season_id,
      effectiveFrom: toDate(row.effective_from),
      effectiveTo: toNullableDate(row.effective_to),
    };
  }

  private toAssignment(
    row: RoleAssignmentRow,
    roleKey: string,
  ): RoleAssignment {
    return {
      id: row.id,
      userId: row.user_id,
      roleId: row.role_id,
      roleKey,
      teamId: row.team_id,
      seasonId: row.season_id,
      effectiveFrom: toDate(row.effective_from),
      effectiveTo: toNullableDate(row.effective_to),
      grantedBy: row.granted_by,
      revokedAt: toNullableDate(row.revoked_at),
      createdAt: toDate(row.created_at),
      version: row.version,
    };
  }
}
