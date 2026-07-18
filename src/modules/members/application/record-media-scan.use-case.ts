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
import { Inject, Injectable } from '@nestjs/common';

import { MediaNotFoundError } from '../errors/media-not-found.error';
import { MediaAssetRepository } from '../infrastructure/media-asset.repository';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { toMediaAssetResponse } from '../lib/member.mapper';
import { MEMBER_MEDIA_SCANNED_EVENT } from '../model/members.constants';
import type {
  MediaAsset,
  MediaAssetResponse,
  NewAuditEvent,
  RecordScanCommand,
} from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Records the malware-scan outcome for a media asset (a system/staff action).
 * Transitions the scan state to clean/infected/failed and audits it. Only a clean
 * asset may later be attached as an avatar or served.
 */
@Injectable()
export class RecordMediaScanUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MemberLookupService,
    private readonly media: MediaAssetRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    mediaId: string,
    command: RecordScanCommand,
  ): Promise<MediaAssetResponse> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, membershipId, mediaId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    mediaId: string,
    command: RecordScanCommand,
  ): Promise<MediaAssetResponse> {
    await this.lookup.requireMembership(scope, teamId, membershipId);
    const existing = await this.media.findById(
      scope,
      teamId,
      membershipId,
      mediaId,
    );
    if (existing === null) {
      throw new MediaNotFoundError();
    }
    const updated = await this.media.updateScanStatus(
      scope,
      mediaId,
      command.outcome,
    );
    if (updated === null) {
      throw new MediaNotFoundError();
    }
    await this.audit.append(scope, this.buildAudit(updated, actor));
    return toMediaAssetResponse(updated);
  }

  private buildAudit(
    asset: MediaAsset,
    actor: AuthUserIdentity,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_MEDIA_SCANNED_EVENT,
      actorUserId: actor.userId,
      context: {
        membershipId: asset.membershipId,
        teamId: asset.teamId,
        mediaId: asset.id,
        outcome: asset.scanStatus,
      },
      occurredAt: this.clock.now(),
    };
  }
}
