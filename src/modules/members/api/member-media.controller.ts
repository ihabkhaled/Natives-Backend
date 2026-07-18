import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AddMemberAliasUseCase } from '../application/add-member-alias.use-case';
import { GetAvatarService } from '../application/get-avatar.service';
import { MemberAliasQueryService } from '../application/member-alias-query.service';
import { RecordMediaScanUseCase } from '../application/record-media-scan.use-case';
import { RemoveMemberAliasUseCase } from '../application/remove-member-alias.use-case';
import { RequestAvatarUploadUseCase } from '../application/request-avatar-upload.use-case';
import { SetMemberAvatarUseCase } from '../application/set-member-avatar.use-case';
import {
  ALIAS_ID_PARAM,
  MEDIA_ID_PARAM,
  MEMBER_ALIAS_BY_ID_ROUTE,
  MEMBER_ALIASES_ROUTE,
  MEMBER_AVATAR_ATTACH_ROUTE,
  MEMBER_AVATAR_ROUTE,
  MEMBER_MEDIA_SCAN_ROUTE,
  MEMBERS_API_TAG,
  MEMBERS_ROUTE,
  MEMBERSHIP_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/members.constants';
import { AddAliasDto } from './dto/add-alias.dto';
import {
  AliasResponseDto,
  ListAliasesResponseDto,
} from './dto/alias-response.dto';
import {
  AvatarAccessResponseDto,
  AvatarTicketResponseDto,
} from './dto/avatar-response.dto';
import { MediaAssetResponseDto } from './dto/media-asset-response.dto';
import { MemberViewResponseDto } from './dto/member-view-response.dto';
import { RecordScanDto } from './dto/record-scan.dto';
import { RequestAvatarDto } from './dto/request-avatar.dto';

@ApiTags(MEMBERS_API_TAG)
@Controller(MEMBERS_ROUTE)
export class MemberMediaController {
  constructor(
    private readonly addAlias: AddMemberAliasUseCase,
    private readonly aliasQuery: MemberAliasQueryService,
    private readonly removeAlias: RemoveMemberAliasUseCase,
    private readonly requestAvatar: RequestAvatarUploadUseCase,
    private readonly setAvatar: SetMemberAvatarUseCase,
    private readonly getAvatar: GetAvatarService,
    private readonly recordScan: RecordMediaScanUseCase,
  ) {}

  @Post(MEMBER_ALIASES_ROUTE)
  @RequirePermissions(Permission.MemberAliasesManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a member alias' })
  @ApiCreatedResponse({ description: 'Alias added', type: AliasResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  add(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: AddAliasDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AliasResponseDto> {
    return this.addAlias.execute(actor, teamId, membershipId, {
      alias: dto.alias,
      source: dto.source ?? null,
    });
  }

  @Get(MEMBER_ALIASES_ROUTE)
  @RequirePermissions(Permission.MemberAliasesManage)
  @ApiOperation({ summary: 'List member aliases' })
  @ApiOkResponse({ description: 'Aliases', type: ListAliasesResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<ListAliasesResponseDto> {
    return this.aliasQuery.listAliases(teamId, membershipId);
  }

  @Delete(MEMBER_ALIAS_BY_ID_ROUTE)
  @RequirePermissions(Permission.MemberAliasesManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member alias' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  remove(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Param(ALIAS_ID_PARAM, UuidValidationPipe) aliasId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<void> {
    return this.removeAlias.execute(actor, teamId, membershipId, aliasId);
  }

  @Post(MEMBER_AVATAR_ROUTE)
  @RequirePermissions(Permission.MemberProfileUpdateSelf)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a signed avatar upload URL' })
  @ApiCreatedResponse({
    description: 'Upload ticket',
    type: AvatarTicketResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  requestUpload(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: RequestAvatarDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AvatarTicketResponseDto> {
    return this.requestAvatar.execute(actor, teamId, membershipId, {
      contentType: dto.contentType,
      byteSize: dto.byteSize,
      width: dto.width ?? null,
      height: dto.height ?? null,
    });
  }

  @Put(MEMBER_AVATAR_ATTACH_ROUTE)
  @RequirePermissions(Permission.MemberProfileUpdateSelf)
  @ApiOperation({ summary: 'Attach a scanned-clean avatar to the profile' })
  @ApiOkResponse({
    description: 'Avatar attached',
    type: MemberViewResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  attach(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Param(MEDIA_ID_PARAM, UuidValidationPipe) mediaId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MemberViewResponseDto> {
    return this.setAvatar.execute(actor, teamId, membershipId, mediaId);
  }

  @Get(MEMBER_AVATAR_ROUTE)
  @RequirePermissions(Permission.MemberProfileReadPublic)
  @ApiOperation({ summary: 'Get a signed avatar download URL (null if none)' })
  @ApiOkResponse({
    description: 'Avatar access',
    type: AvatarAccessResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  access(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<AvatarAccessResponseDto> {
    return this.getAvatar.getAvatarUrl(teamId, membershipId);
  }

  @Post(MEMBER_MEDIA_SCAN_ROUTE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({
    summary: 'Record the malware-scan outcome for a media asset',
  })
  @ApiOkResponse({ description: 'Scan recorded', type: MediaAssetResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  scan(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Param(MEDIA_ID_PARAM, UuidValidationPipe) mediaId: string,
    @Body() dto: RecordScanDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MediaAssetResponseDto> {
    return this.recordScan.execute(actor, teamId, membershipId, mediaId, {
      outcome: dto.outcome,
    });
  }
}
