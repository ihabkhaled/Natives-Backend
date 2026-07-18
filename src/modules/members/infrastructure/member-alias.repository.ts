import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAlias } from '../lib/members.helpers';
import { ALIAS_COLUMNS } from '../model/members.constants';
import type { AliasRow } from '../model/members.rows';
import type { MemberAlias, NewAlias } from '../model/members.types';

/**
 * Persistence for member aliases. Data access only: parameterized SQL, static
 * column lists, soft-delete aware. Active-alias uniqueness per team is enforced
 * by a database partial-unique index; this layer also supports a pre-write
 * conflict lookup so the application can raise a clean, typed conflict error.
 */
@Injectable()
export class MemberAliasRepository {
  async findActiveByNormalized(
    scope: TransactionScope,
    teamId: string,
    normalizedAlias: string,
  ): Promise<MemberAlias | null> {
    const rows = await scope.run<AliasRow>(
      `SELECT ${ALIAS_COLUMNS} FROM "member_aliases"
        WHERE "team_id" = $1 AND "normalized_alias" = $2
          AND "deleted_at" IS NULL`,
      [teamId, normalizedAlias],
    );
    const row = rows[0];
    return row === undefined ? null : toAlias(row);
  }

  async findActiveById(
    scope: TransactionScope,
    membershipId: string,
    aliasId: string,
  ): Promise<MemberAlias | null> {
    const rows = await scope.run<AliasRow>(
      `SELECT ${ALIAS_COLUMNS} FROM "member_aliases"
        WHERE "id" = $1 AND "membership_id" = $2 AND "deleted_at" IS NULL`,
      [aliasId, membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : toAlias(row);
  }

  async insert(scope: TransactionScope, alias: NewAlias): Promise<MemberAlias> {
    const rows = await scope.run<AliasRow>(
      `INSERT INTO "member_aliases" ("id", "membership_id", "team_id", "alias",
              "normalized_alias", "source", "created_by", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${ALIAS_COLUMNS}`,
      [
        alias.id,
        alias.membershipId,
        alias.teamId,
        alias.alias,
        alias.normalizedAlias,
        alias.source,
        alias.createdBy,
        alias.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the alias write');
    }
    return toAlias(row);
  }

  async softDelete(
    scope: TransactionScope,
    aliasId: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await scope.run<AliasRow>(
      `UPDATE "member_aliases" SET "deleted_at" = $2
        WHERE "id" = $1 AND "deleted_at" IS NULL
       RETURNING ${ALIAS_COLUMNS}`,
      [aliasId, now.toISOString()],
    );
    return rows.length > 0;
  }

  async softDeleteAllForMembership(
    scope: TransactionScope,
    membershipId: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "member_aliases" SET "deleted_at" = $2
        WHERE "membership_id" = $1 AND "deleted_at" IS NULL`,
      [membershipId, now.toISOString()],
    );
  }

  async listByMembership(
    scope: TransactionScope,
    membershipId: string,
    limit: number,
  ): Promise<readonly MemberAlias[]> {
    const rows = await scope.run<AliasRow>(
      `SELECT ${ALIAS_COLUMNS} FROM "member_aliases"
        WHERE "membership_id" = $1 AND "deleted_at" IS NULL
        ORDER BY "normalized_alias" ASC, "id" ASC
        LIMIT $2`,
      [membershipId, limit],
    );
    return rows.map(row => toAlias(row));
  }
}
