import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toJobHeartbeat } from '../lib/platform.mapper';
import { JOB_HEARTBEAT_COLUMNS } from '../model/platform.constants';
import { JobOutcome } from '../model/platform.enums';
import type { JobHeartbeatRow } from '../model/platform.rows';
import type { JobHeartbeat, JobHeartbeatInput } from '../model/platform.types';

/**
 * Persistence for scheduled-job heartbeats. One upsert per run: a success
 * resets the consecutive-failure count to zero, a failure increments it. Reads
 * are bounded to the caller-supplied registry keys. Parameterized SQL with
 * static column lists only.
 */
@Injectable()
export class JobHeartbeatRepository {
  async upsert(
    scope: TransactionScope,
    input: JobHeartbeatInput,
  ): Promise<void> {
    const failed = input.outcome === JobOutcome.Failed;
    await scope.run(
      `INSERT INTO "job_heartbeats"
         ("job_key", "last_run_at", "last_outcome", "failure_count", "updated_at")
       VALUES ($1, $2, $3, $4, $2)
       ON CONFLICT ("job_key") DO UPDATE
          SET "last_run_at" = $2, "last_outcome" = $3, "updated_at" = $2,
              "failure_count" = CASE WHEN $3 = 'failed'
                THEN "job_heartbeats"."failure_count" + 1 ELSE 0 END`,
      [input.jobKey, input.now.toISOString(), input.outcome, failed ? 1 : 0],
    );
  }

  async listByKeys(
    scope: TransactionScope,
    jobKeys: readonly string[],
  ): Promise<readonly JobHeartbeat[]> {
    const rows = await scope.run<JobHeartbeatRow>(
      `SELECT ${JOB_HEARTBEAT_COLUMNS} FROM "job_heartbeats"
        WHERE "job_key" = ANY($1::text[])
        ORDER BY "job_key" ASC`,
      [jobKeys],
    );
    return rows.map(row => toJobHeartbeat(row));
  }
}
