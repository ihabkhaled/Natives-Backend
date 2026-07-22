import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toTask } from '../lib/governance.mapper';
import { LIST_MAX_LIMIT, TASK_COLUMNS } from '../model/governance.constants';
import type { GovernanceCountRow, TaskRow } from '../model/governance.rows';
import type {
  GovernanceTask,
  NewGovernanceTask,
  PageRequest,
  TaskListFilter,
  TaskStatusChange,
} from '../model/governance.types';

/**
 * Persistence for governance tasks. Data access only: parameterized SQL, static
 * column lists, optimistic-version-guarded transitions, and bounded reads.
 */
@Injectable()
export class TaskRepository {
  async insert(
    scope: TransactionScope,
    task: NewGovernanceTask,
  ): Promise<GovernanceTask> {
    const rows = await scope.run<TaskRow>(
      `INSERT INTO "governance_tasks"
        ("id", "team_id", "meeting_id", "title", "description",
         "owner_membership_id", "due_date", "priority", "depends_on_task_id",
         "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING ${TASK_COLUMNS}`,
      [
        task.id,
        task.teamId,
        task.meetingId,
        task.title,
        task.description,
        task.ownerMembershipId,
        task.dueDate,
        task.priority,
        task.dependsOnTaskId,
        task.createdBy,
        task.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the task write');
    }
    return toTask(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    taskId: string,
  ): Promise<GovernanceTask | null> {
    const rows = await scope.run<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM "governance_tasks"
        WHERE "id" = $1 AND "team_id" = $2`,
      [taskId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toTask(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: TaskStatusChange,
  ): Promise<GovernanceTask | null> {
    const rows = await scope.run<TaskRow>(
      `UPDATE "governance_tasks"
          SET "status" = $4, "owner_membership_id" = $5, "completed_at" = $6,
              "updated_at" = $7, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${TASK_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.ownerMembershipId,
        change.completedAt === null ? null : change.completedAt.toISOString(),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toTask(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: TaskListFilter,
    page: PageRequest,
  ): Promise<readonly GovernanceTask[]> {
    const rows = await scope.run<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM "governance_tasks"
        WHERE ${this.predicate()}
        ORDER BY "due_date" ASC NULLS LAST, "created_at" DESC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        ...this.filterParameters(teamId, filter),
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toTask(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: TaskListFilter,
  ): Promise<number> {
    const rows = await scope.run<GovernanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "governance_tasks"
        WHERE ${this.predicate()}`,
      this.filterParameters(teamId, filter),
    );
    return Number(rows[0]?.count ?? 0);
  }

  private predicate(): string {
    return `"team_id" = $1
          AND ($2::text IS NULL OR "status" = $2)
          AND ($3::uuid IS NULL OR "owner_membership_id" = $3)
          AND ($4::uuid IS NULL OR "meeting_id" = $4)`;
  }

  private filterParameters(
    teamId: string,
    filter: TaskListFilter,
  ): readonly unknown[] {
    return [teamId, filter.status, filter.ownerMembershipId, filter.meetingId];
  }
}
