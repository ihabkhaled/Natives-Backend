import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { computeMemberEligibility } from '../domain/eligibility-signal.policy';
import { summarizeGenderRatio } from '../domain/gender-ratio.policy';
import { SquadEligibilityRepository } from '../infrastructure/squad-eligibility.repository';
import type {
  EligibilityInputs,
  EligibilityReport,
  GenderRatio,
  PageRequest,
  Squad,
} from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * Computes the advisory eligibility report for a squad's candidate pool
 * (squad.read). Signals are surfaced, never enforced: each candidate carries
 * passed/warning/failed/unknown/overridden checks under the named policy version,
 * plus an advisory gender-ratio balance. Bounded and read-only.
 */
@Injectable()
export class EligibilityReportService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: SquadLookupService,
    private readonly eligibility: SquadEligibilityRepository,
  ) {}

  report(
    teamId: string,
    squadId: string,
    page: PageRequest,
  ): Promise<EligibilityReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.build(tx, teamId, squadId, page),
    );
  }

  private async build(
    tx: TransactionScope,
    teamId: string,
    squadId: string,
    page: PageRequest,
  ): Promise<EligibilityReport> {
    const squad = await this.lookup.require(tx, teamId, squadId);
    const inputs = await this.loadCandidates(tx, squad, page);
    const total = await this.eligibility.countCandidates(
      tx,
      squad.teamId,
      squad.seasonId,
    );
    const ratio = await this.genderRatio(tx, squad.squadId);
    return this.assemble(squad, inputs, total, ratio, page);
  }

  private loadCandidates(
    tx: TransactionScope,
    squad: Squad,
    page: PageRequest,
  ): Promise<readonly EligibilityInputs[]> {
    return this.eligibility.listCandidates(
      tx,
      squad.teamId,
      squad.seasonId,
      squad.squadId,
      page,
    );
  }

  private async genderRatio(
    tx: TransactionScope,
    squadId: string,
  ): Promise<GenderRatio> {
    const counts = await this.eligibility.genderCountsForSelected(tx, squadId);
    return summarizeGenderRatio(counts);
  }

  private assemble(
    squad: Squad,
    inputs: readonly EligibilityInputs[],
    total: number,
    selectedGenderRatio: GenderRatio,
    page: PageRequest,
  ): EligibilityReport {
    return {
      squadId: squad.squadId,
      policyVersion: squad.policyVersion,
      attendanceThresholdPct: squad.attendanceThresholdPct,
      candidates: inputs.map(item =>
        computeMemberEligibility(item, squad.attendanceThresholdPct),
      ),
      selectedGenderRatio,
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
