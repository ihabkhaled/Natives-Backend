import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MediaAssetRepository } from '../infrastructure/media-asset.repository';
import { MEDIA_STORAGE_PORT } from '../model/members.constants';
import { MediaScanStatus } from '../model/members.enums';
import type {
  AvatarAccess,
  MediaAsset,
  MediaStoragePort,
} from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Read side for a member avatar: returns a short-lived signed download URL when a
 * clean avatar exists, or a null URL otherwise. The avatar is optional — a
 * missing, pending, or infected asset yields `null` (never an error), so profile
 * rendering never breaks. Download authorization is rechecked here (the route
 * requires member.profile.read.public and the member is scoped to the team).
 */
@Injectable()
export class GetAvatarService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(MEDIA_STORAGE_PORT) private readonly storage: MediaStoragePort,
    private readonly lookup: MemberLookupService,
    private readonly media: MediaAssetRepository,
  ) {}

  getAvatarUrl(teamId: string, membershipId: string): Promise<AvatarAccess> {
    return this.unitOfWork.runInTransaction(scope =>
      this.load(scope, teamId, membershipId),
    );
  }

  private async load(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<AvatarAccess> {
    const record = await this.lookup.requireRecord(scope, teamId, membershipId);
    const mediaId = record.profile.avatarMediaId;
    if (mediaId === null) {
      return { url: null, expiresAt: null };
    }
    return this.resolveUrl(scope, teamId, membershipId, mediaId);
  }

  private async resolveUrl(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
    mediaId: string,
  ): Promise<AvatarAccess> {
    const asset = await this.media.findById(
      scope,
      teamId,
      membershipId,
      mediaId,
    );
    if (asset === null) {
      return { url: null, expiresAt: null };
    }
    if (asset.scanStatus !== MediaScanStatus.Clean) {
      return { url: null, expiresAt: null };
    }
    return this.sign(asset);
  }

  private sign(asset: MediaAsset): AvatarAccess {
    const signed = this.storage.createDownloadUrl({
      storageKey: asset.storageKey,
      now: this.clock.now(),
    });
    return { url: signed.url, expiresAt: signed.expiresAt };
  }
}
