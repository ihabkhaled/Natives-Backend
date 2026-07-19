import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { PointsLedgerRepository } from '../infrastructure/points-ledger.repository';
import {
  buildLedgerAudit,
  buildPointsReversedEvent,
  buildReversalEntry,
} from '../lib/points.builders';
import { POINTS_REVERSED_ACTION } from '../model/points.constants';
import type {
  ActivityReversalCommand,
  LedgerEntry,
} from '../model/points.types';

/**
 * Compensates an approved-then-corrected activity claim. For each AWARD the
 * submission produced it appends one negative REVERSAL row that exactly offsets it
 * — the awarded history is never edited or deleted. Idempotent by the reversal's
 * unique key, so a retried correction adds no further rows. Badges once earned are
 * milestones and are not revoked.
 */
@Injectable()
export class ReverseActivityPointsService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly ledger: PointsLedgerRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  async reverseForCorrection(
    scope: TransactionScope,
    command: ActivityReversalCommand,
  ): Promise<void> {
    const awards = await this.ledger.awardsForSubmission(
      scope,
      command.submissionId,
    );
    for (const award of awards) {
      await this.reverseOne(scope, command, award);
    }
  }

  private async reverseOne(
    scope: TransactionScope,
    command: ActivityReversalCommand,
    award: LedgerEntry,
  ): Promise<void> {
    const reversal = await this.insertReversal(scope, command, award);
    if (reversal !== null) {
      await this.audit.record(
        scope,
        buildLedgerAudit(POINTS_REVERSED_ACTION, command.actorUserId, reversal),
      );
      await this.events.enqueue(scope, buildPointsReversedEvent(reversal));
    }
  }

  private insertReversal(
    scope: TransactionScope,
    command: ActivityReversalCommand,
    award: LedgerEntry,
  ): Promise<LedgerEntry | null> {
    return this.ledger.insert(
      scope,
      buildReversalEntry(
        this.idGenerator.generate(),
        command,
        award,
        this.clock.now(),
      ),
    );
  }
}
