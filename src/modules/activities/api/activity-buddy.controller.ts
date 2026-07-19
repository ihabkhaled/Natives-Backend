import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { BuddyQueryService } from '../application/buddy-query.service';
import { RespondToBuddyUseCase } from '../application/respond-to-buddy.use-case';
import { resolveActivityPage } from '../lib/activity.helpers';
import {
  ACTIVITIES_API_TAG,
  BUDDY_CONFIRM_ROUTE,
  BUDDY_DECLINE_ROUTE,
  BUDDY_ID_PARAM,
  MY_ACTIVITY_BUDDIES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/activities.constants';
import { BuddyDecision } from '../model/activity.enums';
import { BuddyResponseDto } from './dto/buddy-response.dto';
import { ListActivitiesQueryDto } from './dto/list-activities.query.dto';
import { ListBuddiesResponseDto } from './dto/list-buddies.response.dto';

/**
 * Member self-service surface for training-buddy credits pointing at the caller.
 * The credited member confirms or declines their own participation; ownership is
 * resolved from the token, never a body id.
 */
@ApiTags(ACTIVITIES_API_TAG)
@Controller(MY_ACTIVITY_BUDDIES_ROUTE)
export class ActivityBuddyController {
  constructor(
    private readonly query: BuddyQueryService,
    private readonly respond: RespondToBuddyUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.ActivityReadSelf)
  @ApiOperation({ summary: 'List my pending training-buddy credits' })
  @ApiOkResponse({ type: ListBuddiesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListActivitiesQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListBuddiesResponseDto> {
    return this.query.listPendingForMember(
      teamId,
      actor.userId,
      resolveActivityPage(query.limit, query.offset),
    );
  }

  @Post(BUDDY_CONFIRM_ROUTE)
  @RequirePermissions(Permission.ActivitySubmitSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a training-buddy credit' })
  @ApiOkResponse({ type: BuddyResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  confirm(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(BUDDY_ID_PARAM, UuidValidationPipe) buddyId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<BuddyResponseDto> {
    return this.respond.execute(actor, teamId, buddyId, BuddyDecision.Confirm);
  }

  @Post(BUDDY_DECLINE_ROUTE)
  @RequirePermissions(Permission.ActivitySubmitSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a training-buddy credit' })
  @ApiOkResponse({ type: BuddyResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  decline(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(BUDDY_ID_PARAM, UuidValidationPipe) buddyId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<BuddyResponseDto> {
    return this.respond.execute(actor, teamId, buddyId, BuddyDecision.Decline);
  }
}
