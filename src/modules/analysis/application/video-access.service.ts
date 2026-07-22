import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { VideoAccessDeniedError } from '../errors/video-access-denied.error';
import { buildAccessGrantedAudit } from '../lib/analysis.builders';
import { VIDEO_ACCESS_PORT } from '../model/analysis.constants';
import { VideoAccessPolicy } from '../model/analysis.enums';
import type {
  VideoAccessGrant,
  VideoAccessPort,
  VideoSource,
} from '../model/analysis.types';
import { AnalysisAuthorityService } from './analysis-authority.service';
import { AnalysisLookupService } from './analysis-lookup.service';

/**
 * Mints a short-lived signed provider handle for one recording (UN-505). The
 * application never proxies video: it hands back a provider URL that expires,
 * and only after the source's own access policy has been satisfied. A
 * `restricted` source is refused to everyone but a team analyst, and a
 * `coaches` source is refused to a plain player even though they can see the
 * clips cut from it — the clip is the sanctioned view, the raw recording is not.
 * Every grant is audited.
 */
@Injectable()
export class VideoAccessService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(VIDEO_ACCESS_PORT) private readonly access: VideoAccessPort,
    private readonly lookup: AnalysisLookupService,
    private readonly authority: AnalysisAuthorityService,
    private readonly audit: AuditRecorderService,
  ) {}

  async grant(
    actor: AuthUserIdentity,
    teamId: string,
    sourceId: string,
  ): Promise<VideoAccessGrant> {
    const analyst = await this.authority.canReadTeamAnalysis(actor, teamId);
    const manager = await this.authority.canManageAnalysis(actor, teamId);
    return this.unitOfWork.runInTransaction(async tx => {
      const source = await this.lookup.requireSource(tx, teamId, sourceId);
      this.assertAllowed(source, analyst, manager);
      await this.audit.record(
        tx,
        buildAccessGrantedAudit(actor.userId, source),
      );
      return this.ticketFor(source);
    });
  }

  private assertAllowed(
    source: VideoSource,
    analyst: boolean,
    manager: boolean,
  ): void {
    if (!this.isAllowed(source.accessPolicy, analyst, manager)) {
      throw new VideoAccessDeniedError();
    }
  }

  private isAllowed(
    policy: VideoAccessPolicy,
    analyst: boolean,
    manager: boolean,
  ): boolean {
    if (policy === VideoAccessPolicy.Team) {
      return true;
    }
    if (policy === VideoAccessPolicy.Coaches) {
      return analyst;
    }
    return manager;
  }

  private ticketFor(source: VideoSource): VideoAccessGrant {
    const ticket = this.access.createAccessTicket({
      provider: source.provider,
      externalRef: source.externalRef,
      now: this.clock.now(),
    });
    return {
      sourceId: source.sourceId,
      provider: source.provider,
      url: ticket.url,
      expiresAt: ticket.expiresAt,
      syncOffsetSeconds: source.syncOffsetSeconds,
    };
  }
}
