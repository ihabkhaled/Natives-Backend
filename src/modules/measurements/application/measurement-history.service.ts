import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MeasurementAttemptRepository } from '../infrastructure/measurement-attempt.repository';
import { MeasurementProtocolRepository } from '../infrastructure/measurement-protocol.repository';
import { buildHistoryEntries } from '../lib/measurements.builders';
import type {
  MeasurementAttempt,
  MeasurementHistory,
} from '../model/measurements.types';
import { MeasurementScopeService } from './measurement-scope.service';

/**
 * Read side of a player's objective-measurement history. Attempts are grouped by
 * protocol and each protocol's derived result (best/average/latest, per its
 * direction and policy) is computed by the pure selection policy — missing
 * attempts stay excluded, never zero. Team reads target any membership
 * (analytics.read.team); the self read resolves the caller's own membership from
 * the token (analytics.read.self) so a member only ever reads their own history.
 */
@Injectable()
export class MeasurementHistoryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly scope: MeasurementScopeService,
    private readonly protocols: MeasurementProtocolRepository,
    private readonly attempts: MeasurementAttemptRepository,
  ) {}

  getForMembership(
    teamId: string,
    membershipId: string,
  ): Promise<MeasurementHistory> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.scope.validate(tx, teamId, null);
      await this.scope.requireMembership(tx, teamId, membershipId);
      return this.historyFor(tx, teamId, membershipId);
    });
  }

  getForUser(teamId: string, userId: string): Promise<MeasurementHistory> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.scope.validate(tx, teamId, null);
      const membershipId = await this.scope.resolveMembershipForUser(
        tx,
        teamId,
        userId,
      );
      return this.historyFor(tx, teamId, membershipId);
    });
  }

  private async historyFor(
    tx: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<MeasurementHistory> {
    const attempts = await this.attempts.listForMembership(
      tx,
      teamId,
      membershipId,
    );
    const protocols = await this.protocols.listByIds(
      tx,
      teamId,
      this.distinctProtocolIds(attempts),
    );
    return { membershipId, entries: buildHistoryEntries(protocols, attempts) };
  }

  private distinctProtocolIds(
    attempts: readonly MeasurementAttempt[],
  ): readonly string[] {
    return [...new Set(attempts.map(attempt => attempt.protocolId))];
  }
}
