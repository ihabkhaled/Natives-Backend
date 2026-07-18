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
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CalendarFeedService } from '../application/calendar-feed.service';
import {
  CALENDAR_FEED_BY_ID_ROUTE,
  CALENDAR_FEEDS_ROUTE,
  FEED_ID_PARAM,
} from '../model/calendar.constants';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import {
  CalendarFeedResponseDto,
  CalendarFeedRevokeResponseDto,
} from './dto/calendar-feed-response.dto';
import { CreateCalendarFeedDto } from './dto/create-calendar-feed.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class PracticeCalendarController {
  constructor(private readonly feeds: CalendarFeedService) {}

  @Post(CALENDAR_FEEDS_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a revocable practice calendar feed' })
  @ApiCreatedResponse({ type: CalendarFeedResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateCalendarFeedDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CalendarFeedResponseDto> {
    return this.feeds.create(actor, teamId, {
      seasonId: dto.seasonId ?? null,
      timezone: dto.timezone ?? null,
      expiresInDays: dto.expiresInDays ?? null,
    });
  }

  @Delete(CALENDAR_FEED_BY_ID_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'Revoke one of my practice calendar feeds' })
  @ApiOkResponse({ type: CalendarFeedRevokeResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revoke(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEED_ID_PARAM, UuidValidationPipe) feedId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CalendarFeedRevokeResponseDto> {
    return this.feeds.revoke(actor, teamId, feedId);
  }
}
