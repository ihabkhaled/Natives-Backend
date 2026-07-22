import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import { TryoutSelectionRepository } from '../infrastructure/tryout-selection.repository';
import { buildFunnelReport } from '../lib/tryouts.builders';
import type { TryoutFunnelReport } from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * The privacy-safe tryout funnel: per-status candidate counts plus each
 * evaluator's completion progress. It deliberately returns NO identities,
 * ratings, notes, or contact details — a funnel is an operational metric, and an
 * anonymized candidate still counts in it, which is exactly why the counts stay
 * truthful after retention has run.
 */
@Injectable()
export class TryoutFunnelService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly candidates: TryoutCandidateRepository,
    private readonly selection: TryoutSelectionRepository,
    private readonly lookup: TryoutLookupService,
  ) {}

  forEvent(teamId: string, eventId: string): Promise<TryoutFunnelReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.build(tx, teamId, eventId),
    );
  }

  private async build(
    tx: TransactionScope,
    teamId: string,
    eventId: string,
  ): Promise<TryoutFunnelReport> {
    await this.lookup.requireEvent(tx, teamId, eventId);
    const counts = await this.candidates.countByStatus(tx, eventId);
    const evaluators = await this.selection.listEvaluatorCompletion(
      tx,
      eventId,
    );
    return buildFunnelReport(eventId, counts, evaluators);
  }
}
