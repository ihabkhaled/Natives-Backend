import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { VideoSourceRepository } from '../infrastructure/video-source.repository';
import type {
  PageRequest,
  VideoSource,
  VideoSourceListFilter,
  VideoSourcePage,
} from '../model/analysis.types';
import { AnalysisLookupService } from './analysis-lookup.service';

/**
 * Read side of registered video sources. Lists a team's sources in a bounded,
 * deterministically ordered page under allow-listed filters and resolves one
 * source (a miss is a 404). One transaction per call.
 */
@Injectable()
export class VideoSourceQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: VideoSourceRepository,
    private readonly lookup: AnalysisLookupService,
  ) {}

  listForScope(
    teamId: string,
    filter: VideoSourceListFilter,
    page: PageRequest,
  ): Promise<VideoSourcePage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, sourceId: string): Promise<VideoSource> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireSource(tx, teamId, sourceId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: VideoSourceListFilter,
    page: PageRequest,
  ): Promise<VideoSourcePage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
