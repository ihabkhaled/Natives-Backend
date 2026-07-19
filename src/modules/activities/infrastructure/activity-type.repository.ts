import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toActivityType } from '../lib/activity.mapper';
import { ACTIVITY_TYPE_COLUMNS } from '../model/activities.constants';
import type { ActivityTypeRow, CountRow } from '../model/activity.rows';
import type { ActivityType, PageRequest } from '../model/activity.types';

/**
 * Persistence for the versioned activity-type catalog. Data access only:
 * parameterized SQL, static column lists, bounded and deterministically ordered
 * reads over active types.
 */
@Injectable()
export class ActivityTypeRepository {
  async listActive(
    scope: TransactionScope,
    page: PageRequest,
  ): Promise<readonly ActivityType[]> {
    const rows = await scope.run<ActivityTypeRow>(
      `SELECT ${ACTIVITY_TYPE_COLUMNS} FROM "activity_types"
        WHERE "status" = 'active'
        ORDER BY "category" ASC, "type_key" ASC, "id" ASC
        LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    return rows.map(row => toActivityType(row));
  }

  async countActive(scope: TransactionScope): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "activity_types"
        WHERE "status" = 'active'`,
    );
    return rows[0]?.count ?? 0;
  }

  async findActiveById(
    scope: TransactionScope,
    typeId: string,
  ): Promise<ActivityType | null> {
    const rows = await scope.run<ActivityTypeRow>(
      `SELECT ${ACTIVITY_TYPE_COLUMNS} FROM "activity_types"
        WHERE "id" = $1 AND "status" = 'active'`,
      [typeId],
    );
    const row = rows[0];
    return row === undefined ? null : toActivityType(row);
  }
}
