import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  evaluateConstraints,
  isPublishable,
  summarizeComposition,
} from '../domain/roster-composition.policy';
import { RosterConstraintError } from '../errors/roster-constraint.error';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { toStoredConstraints } from '../lib/rosters-command.mapper';
import type { Roster, RosterValidationReport } from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * Server-side roster validation (roster.read for the preview). The SAME function
 * powers the draft-time preview a coach reads and the enforcement at publish and
 * lock, so a roster can never be frozen in a shape the preview called invalid.
 * Warnings are advisory and never block.
 */
@Injectable()
export class RosterValidationService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: RosterLookupService,
    private readonly entries: RosterEntryRepository,
  ) {}

  preview(teamId: string, rosterId: string): Promise<RosterValidationReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.report(tx, teamId, rosterId),
    );
  }

  /** Build the report for an already-resolved roster inside a caller's tx. */
  async evaluate(
    tx: TransactionScope,
    roster: Roster,
  ): Promise<RosterValidationReport> {
    const entries = await this.entries.listActive(tx, roster.rosterId);
    const composition = summarizeComposition(entries);
    const violations = evaluateConstraints(
      composition,
      toStoredConstraints(roster),
    );
    return {
      rosterId: roster.rosterId,
      policyVersion: roster.policyVersion,
      status: roster.status,
      composition,
      violations,
      publishable: isPublishable(violations),
    };
  }

  /** Refuse to freeze a roster that still breaks a blocking constraint. */
  async assertPublishable(
    tx: TransactionScope,
    roster: Roster,
  ): Promise<RosterValidationReport> {
    const report = await this.evaluate(tx, roster);
    if (!report.publishable) {
      throw new RosterConstraintError();
    }
    return report;
  }

  private async report(
    tx: TransactionScope,
    teamId: string,
    rosterId: string,
  ): Promise<RosterValidationReport> {
    const roster = await this.lookup.require(tx, teamId, rosterId);
    return this.evaluate(tx, roster);
  }
}
