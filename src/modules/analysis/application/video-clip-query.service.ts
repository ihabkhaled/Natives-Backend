import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  applyCommentVisibility,
  canViewClip,
} from '../domain/clip-visibility.policy';
import { ClipNotVisibleError } from '../errors/clip-not-visible.error';
import { VideoClipRepository } from '../infrastructure/video-clip.repository';
import type {
  ClipViewer,
  PageRequest,
  VideoClipListFilter,
  VideoClipPage,
  VideoClipView,
} from '../model/analysis.types';
import { AnalysisAuthorityService } from './analysis-authority.service';
import { AnalysisLookupService } from './analysis-lookup.service';
import { AnalysisScopeService } from './analysis-scope.service';
import { ClipViewService } from './clip-view.service';

/**
 * Read side of the analysis clip queue. Every result passes the visibility
 * policy before it leaves the service: a player sees only PUBLISHED clips
 * addressed to them, and a coach-only note is redacted to null rather than
 * returned as empty text. A clip the caller may not see resolves to a
 * forbidden-shaped refusal on direct access and simply does not appear in a list.
 */
@Injectable()
export class VideoClipQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: VideoClipRepository,
    private readonly lookup: AnalysisLookupService,
    private readonly views: ClipViewService,
    private readonly scopes: AnalysisScopeService,
    private readonly authority: AnalysisAuthorityService,
  ) {}

  async listForScope(
    actor: AuthUserIdentity,
    teamId: string,
    filter: VideoClipListFilter,
    page: PageRequest,
  ): Promise<VideoClipPage> {
    const analyst = await this.authority.canReadTeamAnalysis(actor, teamId);
    return this.unitOfWork.runInTransaction(async tx =>
      this.page(
        tx,
        teamId,
        await this.viewer(tx, actor, teamId, analyst),
        filter,
        page,
      ),
    );
  }

  async getById(
    actor: AuthUserIdentity,
    teamId: string,
    clipId: string,
  ): Promise<VideoClipView> {
    const analyst = await this.authority.canReadTeamAnalysis(actor, teamId);
    return this.unitOfWork.runInTransaction(async tx => {
      const viewer = await this.viewer(tx, actor, teamId, analyst);
      const clip = await this.lookup.requireClip(tx, teamId, clipId);
      const view = await this.views.assembleOne(tx, clip);
      return this.requireVisible(view, viewer);
    });
  }

  async viewer(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    canReadTeamAnalysis: boolean,
  ): Promise<ClipViewer> {
    const membershipIds = await this.scopes.listViewerMemberships(
      tx,
      teamId,
      actor.userId,
    );
    return { userId: actor.userId, canReadTeamAnalysis, membershipIds };
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    viewer: ClipViewer,
    filter: VideoClipListFilter,
    page: PageRequest,
  ): Promise<VideoClipPage> {
    const clips = await this.repository.listForScope(tx, teamId, filter, page);
    const assembled = await this.views.assemble(tx, clips);
    const visible = assembled
      .filter(view => canViewClip(view, viewer))
      .map(view => applyCommentVisibility(view, viewer));
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items: visible, total, limit: page.limit, offset: page.offset };
  }

  private requireVisible(
    view: VideoClipView,
    viewer: ClipViewer,
  ): VideoClipView {
    if (!canViewClip(view, viewer)) {
      throw new ClipNotVisibleError();
    }
    return applyCommentVisibility(view, viewer);
  }
}
