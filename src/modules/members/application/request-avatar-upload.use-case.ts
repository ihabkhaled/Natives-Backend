import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isValidAvatarUpload } from '../domain/media-validation.policy';
import { MediaValidationError } from '../errors/media-validation.error';
import { ProfileForbiddenError } from '../errors/profile-forbidden.error';
import { MediaAssetRepository } from '../infrastructure/media-asset.repository';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import {
  DEFAULT_MEDIA_PURPOSE,
  MEDIA_KEY_PREFIX,
  MEDIA_STORAGE_PORT,
  MEMBER_AVATAR_REQUESTED_EVENT,
} from '../model/members.constants';
import type {
  AvatarUploadTicket,
  MediaAsset,
  MediaStoragePort,
  Membership,
  NewAuditEvent,
  RequestAvatarCommand,
} from '../model/members.types';
import { MemberAccessService } from './member-access.service';
import { MemberLookupService } from './member-lookup.service';

/**
 * Registers an avatar upload: validates the media (type/size/dimension), creates
 * a `pending`-scan asset record scoped to an isolated object-storage key, and
 * returns a short-lived signed upload URL from the media port. No bytes touch the
 * application or database. Restricted to the member themselves or a manager.
 */
@Injectable()
export class RequestAvatarUploadUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(MEDIA_STORAGE_PORT) private readonly storage: MediaStoragePort,
    private readonly lookup: MemberLookupService,
    private readonly access: MemberAccessService,
    private readonly media: MediaAssetRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  async execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: RequestAvatarCommand,
  ): Promise<AvatarUploadTicket> {
    const membership = await this.loadMembership(teamId, membershipId);
    const access = await this.access.resolveAccess(actor, teamId, membership);
    if (!access.canManage && !access.viewer.isSelf) {
      throw new ProfileForbiddenError();
    }
    if (!isValidAvatarUpload(command)) {
      throw new MediaValidationError();
    }
    return this.register(actor, membership, command);
  }

  private loadMembership(
    teamId: string,
    membershipId: string,
  ): Promise<Membership> {
    return this.unitOfWork.runInTransaction(scope =>
      this.lookup.requireMembership(scope, teamId, membershipId),
    );
  }

  private register(
    actor: AuthUserIdentity,
    membership: Membership,
    command: RequestAvatarCommand,
  ): Promise<AvatarUploadTicket> {
    return this.unitOfWork.runInTransaction(async scope => {
      const now = this.clock.now();
      const mediaId = this.idGenerator.generate();
      const storageKey = `${MEDIA_KEY_PREFIX}/${membership.teamId}/${membership.id}/${mediaId}`;
      const asset = await this.media.insert(scope, {
        id: mediaId,
        teamId: membership.teamId,
        membershipId: membership.id,
        purpose: DEFAULT_MEDIA_PURPOSE,
        storageKey,
        contentType: command.contentType,
        byteSize: command.byteSize,
        width: command.width,
        height: command.height,
        createdBy: actor.userId,
        now,
      });
      await this.audit.append(scope, this.buildAudit(asset, actor, now));
      const signed = this.storage.createUploadUrl({
        storageKey: asset.storageKey,
        contentType: asset.contentType,
        now,
      });
      return {
        mediaId: asset.id,
        storageKey: asset.storageKey,
        uploadUrl: signed.url,
        expiresAt: signed.expiresAt,
      };
    });
  }

  private buildAudit(
    asset: MediaAsset,
    actor: AuthUserIdentity,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_AVATAR_REQUESTED_EVENT,
      actorUserId: actor.userId,
      context: {
        membershipId: asset.membershipId,
        teamId: asset.teamId,
        mediaId: asset.id,
      },
      occurredAt: now,
    };
  }
}
