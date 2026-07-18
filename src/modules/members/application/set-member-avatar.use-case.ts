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

import { classifyAge } from '../domain/member-age.policy';
import { shapeMemberView } from '../domain/member-privacy.policy';
import { MediaNotFoundError } from '../errors/media-not-found.error';
import { MediaNotScannedError } from '../errors/media-not-scanned.error';
import { MembershipNotFoundError } from '../errors/membership-not-found.error';
import { ProfileForbiddenError } from '../errors/profile-forbidden.error';
import { MediaAssetRepository } from '../infrastructure/media-asset.repository';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { MemberProfileRepository } from '../infrastructure/member-profile.repository';
import { MEMBER_AVATAR_ATTACHED_EVENT } from '../model/members.constants';
import { MediaScanStatus } from '../model/members.enums';
import type {
  MemberRecord,
  Membership,
  MemberView,
  NewAuditEvent,
} from '../model/members.types';
import { MemberAccessService } from './member-access.service';
import { MemberLookupService } from './member-lookup.service';

/**
 * Attaches a scanned-clean media asset as the member's active avatar. Rejects any
 * asset that has not cleared the malware scan. Restricted to the member or a
 * manager; returns the profile shaped for the actor's audience.
 */
@Injectable()
export class SetMemberAvatarUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MemberLookupService,
    private readonly access: MemberAccessService,
    private readonly profiles: MemberProfileRepository,
    private readonly media: MediaAssetRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  async execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    mediaId: string,
  ): Promise<MemberView> {
    const membership = await this.loadMembership(teamId, membershipId);
    const access = await this.access.resolveAccess(actor, teamId, membership);
    if (!access.canManage && !access.viewer.isSelf) {
      throw new ProfileForbiddenError();
    }
    const record = await this.attach(actor, membership, mediaId);
    const age = classifyAge(record.profile.dateOfBirth, this.clock.now());
    return shapeMemberView(record, access.viewer, age);
  }

  private loadMembership(
    teamId: string,
    membershipId: string,
  ): Promise<Membership> {
    return this.unitOfWork.runInTransaction(scope =>
      this.lookup.requireMembership(scope, teamId, membershipId),
    );
  }

  private attach(
    actor: AuthUserIdentity,
    membership: Membership,
    mediaId: string,
  ): Promise<MemberRecord> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runAttach(scope, actor, membership, mediaId),
    );
  }

  private async runAttach(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    membership: Membership,
    mediaId: string,
  ): Promise<MemberRecord> {
    const asset = await this.media.findById(
      scope,
      membership.teamId,
      membership.id,
      mediaId,
    );
    if (asset === null) {
      throw new MediaNotFoundError();
    }
    if (asset.scanStatus !== MediaScanStatus.Clean) {
      throw new MediaNotScannedError();
    }
    const now = this.clock.now();
    const profile = await this.profiles.updateAvatar(
      scope,
      membership.id,
      mediaId,
      actor.userId,
      now,
    );
    if (profile === null) {
      throw new MembershipNotFoundError();
    }
    await this.audit.append(
      scope,
      this.buildAudit(membership, mediaId, actor, now),
    );
    return { membership, profile };
  }

  private buildAudit(
    membership: Membership,
    mediaId: string,
    actor: AuthUserIdentity,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_AVATAR_ATTACHED_EVENT,
      actorUserId: actor.userId,
      context: {
        membershipId: membership.id,
        teamId: membership.teamId,
        mediaId,
      },
      occurredAt: now,
    };
  }
}
