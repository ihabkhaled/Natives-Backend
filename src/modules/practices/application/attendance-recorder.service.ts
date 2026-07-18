import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';
import { AttendanceRecordRevisionRepository } from '../infrastructure/attendance-record-revision.repository';
import {
  buildAttendanceRevision,
  buildNewRecord,
  buildRecordAudit,
  buildRecordUpdate,
} from '../lib/attendance.builders';
import type {
  AttendanceRecord,
  AttendanceWriteContext,
} from '../model/attendance.types';

/**
 * Records one effective attendance mark inside the caller's transaction: it upserts
 * the single effective row under optimistic concurrency, appends an immutable
 * revision (marking corrections), and writes an audit row — so the change and its
 * evidence commit atomically. Shared by the coach record, self check-in, and
 * correction paths. It never opens its own transaction and never awards points.
 */
@Injectable()
export class AttendanceRecorderService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly records: AttendanceRecordRepository,
    private readonly revisions: AttendanceRecordRevisionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  async record(
    scope: TransactionScope,
    ctx: AttendanceWriteContext,
  ): Promise<AttendanceRecord> {
    const existing = await this.records.findBySessionMembership(
      scope,
      ctx.session.id,
      ctx.membershipId,
    );
    const record = await this.persist(scope, ctx, existing);
    await this.recordEffects(scope, ctx, existing, record);
    return record;
  }

  private persist(
    scope: TransactionScope,
    ctx: AttendanceWriteContext,
    existing: AttendanceRecord | null,
  ): Promise<AttendanceRecord> {
    return existing === null
      ? this.insert(scope, ctx)
      : this.update(scope, ctx, existing);
  }

  private async insert(
    scope: TransactionScope,
    ctx: AttendanceWriteContext,
  ): Promise<AttendanceRecord> {
    const created = await this.records.insert(
      scope,
      buildNewRecord(this.idGenerator.generate(), ctx),
    );
    if (created === null) {
      throw new OptimisticConflictError();
    }
    return created;
  }

  private async update(
    scope: TransactionScope,
    ctx: AttendanceWriteContext,
    existing: AttendanceRecord,
  ): Promise<AttendanceRecord> {
    this.assertExpectedVersion(existing, ctx);
    const updated = await this.records.update(
      scope,
      buildRecordUpdate(existing, ctx),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    return updated;
  }

  private assertExpectedVersion(
    existing: AttendanceRecord,
    ctx: AttendanceWriteContext,
  ): void {
    if (
      ctx.expectedVersion !== null &&
      existing.version !== ctx.expectedVersion
    ) {
      throw new OptimisticConflictError();
    }
  }

  private async recordEffects(
    scope: TransactionScope,
    ctx: AttendanceWriteContext,
    existing: AttendanceRecord | null,
    record: AttendanceRecord,
  ): Promise<void> {
    await this.revisions.append(
      scope,
      buildAttendanceRevision(
        this.idGenerator.generate(),
        existing,
        record,
        ctx,
      ),
    );
    await this.audit.record(scope, buildRecordAudit(ctx, record));
  }
}
