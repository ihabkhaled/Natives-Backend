import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';

import { SignedUrlMediaStorageAdapter } from './adapters/signed-url-media-storage.adapter';
import { MemberMediaController } from './api/member-media.controller';
import { MembersController } from './api/members.controller';
import { AddMemberAliasUseCase } from './application/add-member-alias.use-case';
import { AnonymizeMemberUseCase } from './application/anonymize-member.use-case';
import { GetAvatarService } from './application/get-avatar.service';
import { InviteMemberUseCase } from './application/invite-member.use-case';
import { MemberAccessService } from './application/member-access.service';
import { MemberAliasQueryService } from './application/member-alias-query.service';
import { MemberDirectoryService } from './application/member-directory.service';
import { MemberHistoryService } from './application/member-history.service';
import { MemberLookupService } from './application/member-lookup.service';
import { MemberViewService } from './application/member-view.service';
import { RecordMediaScanUseCase } from './application/record-media-scan.use-case';
import { RemoveMemberAliasUseCase } from './application/remove-member-alias.use-case';
import { RequestAvatarUploadUseCase } from './application/request-avatar-upload.use-case';
import { SetMemberAvatarUseCase } from './application/set-member-avatar.use-case';
import { TransitionMemberUseCase } from './application/transition-member.use-case';
import { UpdateMemberProfileUseCase } from './application/update-member-profile.use-case';
import { MediaAssetRepository } from './infrastructure/media-asset.repository';
import { MemberAliasRepository } from './infrastructure/member-alias.repository';
import { MemberAuditRepository } from './infrastructure/member-audit.repository';
import { MemberProfileRepository } from './infrastructure/member-profile.repository';
import { MembershipRepository } from './infrastructure/membership.repository';
import { StatusEventRepository } from './infrastructure/status-event.repository';
import { TeamScopeRepository } from './infrastructure/team-scope.repository';
import { MEDIA_STORAGE_PORT } from './model/members.constants';

/**
 * Members bounded context: membership lifecycle, player profiles, media assets,
 * aliases, and field-level privacy. Separates account, membership, and profile so
 * historical players need no login. Owns its persistence (raw SQL via the global
 * UnitOfWorkPort), binds the object-storage media port, and depends on the RBAC
 * resolver (via RbacModule) to shape reads by the viewer's effective permissions.
 * No other module imports its internals.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, RbacModule],
  controllers: [MembersController, MemberMediaController],
  providers: [
    { provide: MEDIA_STORAGE_PORT, useClass: SignedUrlMediaStorageAdapter },
    MembershipRepository,
    MemberProfileRepository,
    StatusEventRepository,
    MemberAliasRepository,
    MediaAssetRepository,
    MemberAuditRepository,
    TeamScopeRepository,
    MemberLookupService,
    MemberAccessService,
    MemberDirectoryService,
    MemberViewService,
    MemberAliasQueryService,
    MemberHistoryService,
    GetAvatarService,
    InviteMemberUseCase,
    TransitionMemberUseCase,
    AnonymizeMemberUseCase,
    UpdateMemberProfileUseCase,
    AddMemberAliasUseCase,
    RemoveMemberAliasUseCase,
    RequestAvatarUploadUseCase,
    RecordMediaScanUseCase,
    SetMemberAvatarUseCase,
  ],
})
export class MembersModule {}
