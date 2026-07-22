import { createHash } from 'node:crypto';

import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { MigrationValidationError } from '../errors/migration-validation.error';
import { MigrationVersionConflictError } from '../errors/migration-version-conflict.error';
import { FormulaComparisonRepository } from '../infrastructure/formula-comparison.repository';
import {
  buildComparison,
  buildComparisonAudit,
} from '../lib/migration.builders';
import {
  COMPARISON_SIGNED_ACTION,
  SOURCE_HASH_ALGORITHM,
} from '../model/migration.constants';
import type {
  FormulaComparison,
  RecordComparisonCommand,
  SignOffCommand,
} from '../model/migration.types';
import { MigrationLookupService } from './migration-lookup.service';

/**
 * Records a target-vs-legacy formula comparison and captures the human sign-off
 * required before production import (UN-704).
 *
 * The comparison is classified automatically (matching, rounding, broken
 * reference, missing-vs-zero, version difference, target bug, …) and stores a
 * checksum of the compared artifact, so a reviewer signs a labelled, immutable
 * record. Sign-off is a NAMED human act: a re-computed comparison clears any
 * prior sign-off, so a value that changed can never carry a stale approval into
 * production.
 */
@Injectable()
export class CompareFormulaUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: MigrationLookupService,
    private readonly comparisons: FormulaComparisonRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  record(
    _actor: AuthUserIdentity,
    teamId: string,
    command: RecordComparisonCommand,
  ): Promise<FormulaComparison> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runRecord(tx, teamId, command),
    );
  }

  signOff(
    actor: AuthUserIdentity,
    teamId: string,
    comparisonId: string,
    command: SignOffCommand,
  ): Promise<FormulaComparison> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runSignOff(tx, actor, teamId, comparisonId, command),
    );
  }

  private async runRecord(
    tx: TransactionScope,
    teamId: string,
    command: RecordComparisonCommand,
  ): Promise<FormulaComparison> {
    await this.lookup.requireTeam(tx, teamId);
    const legacyBroken =
      command.legacyValue === null && command.targetValue !== null;
    const checksum = this.checksumOf(command);
    return this.comparisons.upsert(
      tx,
      buildComparison(
        this.ids.generate(),
        teamId,
        command,
        legacyBroken,
        checksum,
        this.clock.now(),
      ),
    );
  }

  private async runSignOff(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    comparisonId: string,
    command: SignOffCommand,
  ): Promise<FormulaComparison> {
    await this.lookup.requireComparison(tx, teamId, comparisonId);
    if (command.signedOffByName.trim().length === 0) {
      throw new MigrationValidationError();
    }
    const signed = await this.comparisons.signOff(tx, {
      id: comparisonId,
      teamId,
      expectedRecordVersion: command.expectedRecordVersion,
      signedOffByName: command.signedOffByName.trim(),
      now: this.clock.now(),
    });
    if (signed === null) {
      throw new MigrationVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildComparisonAudit(COMPARISON_SIGNED_ACTION, actor.userId, signed),
    );
    return signed;
  }

  private checksumOf(command: RecordComparisonCommand): string {
    return createHash(SOURCE_HASH_ALGORITHM)
      .update(
        JSON.stringify({
          workbookType: command.workbookType,
          metric: command.metric,
          subjectRef: command.subjectRef,
          legacyValue: command.legacyValue,
          targetValue: command.targetValue,
        }),
      )
      .digest('hex');
  }
}
