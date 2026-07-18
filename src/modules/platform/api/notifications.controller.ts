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
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ListNotificationsService } from '../application/list-notifications.service';
import { MarkNotificationReadService } from '../application/mark-notification-read.service';
import { NotificationPreferencesService } from '../application/notification-preferences.service';
import { NotificationQuietHoursService } from '../application/notification-quiet-hours.service';
import { resolvePage } from '../lib/platform.helpers';
import {
  NOTIFICATION_ID_PARAM,
  NOTIFICATION_PREFERENCES_ROUTE,
  NOTIFICATION_QUIET_HOURS_ROUTE,
  NOTIFICATION_READ_ROUTE,
  NOTIFICATIONS_API_TAG,
  NOTIFICATIONS_ROUTE,
} from '../model/platform.constants';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import {
  ListNotificationsResponseDto,
  NotificationViewDto,
} from './dto/notification-response.dto';
import { PreferencesResponseDto } from './dto/preferences-response.dto';
import {
  QuietHoursResponseDto,
  UpdateQuietHoursDto,
} from './dto/quiet-hours.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags(NOTIFICATIONS_API_TAG)
@Controller(NOTIFICATIONS_ROUTE)
export class NotificationsController {
  constructor(
    private readonly list: ListNotificationsService,
    private readonly markService: MarkNotificationReadService,
    private readonly preferences: NotificationPreferencesService,
    private readonly quietHours: NotificationQuietHoursService,
  ) {}

  @Get(NOTIFICATION_QUIET_HOURS_ROUTE)
  @RequirePermissions(Permission.NotificationPreferencesSelf)
  @ApiOperation({ summary: 'Get my notification quiet hours' })
  @ApiOkResponse({ type: QuietHoursResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getQuietHours(
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<QuietHoursResponseDto> {
    return this.quietHours.get(actor);
  }

  @Put(NOTIFICATION_QUIET_HOURS_ROUTE)
  @RequirePermissions(Permission.NotificationPreferencesSelf)
  @ApiOperation({ summary: 'Update my notification quiet hours' })
  @ApiOkResponse({ type: QuietHoursResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  updateQuietHours(
    @Body() dto: UpdateQuietHoursDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<QuietHoursResponseDto> {
    return this.quietHours.update(actor, dto);
  }

  @Get(NOTIFICATION_PREFERENCES_ROUTE)
  @RequirePermissions(Permission.NotificationPreferencesSelf)
  @ApiOperation({ summary: 'Get my notification preferences' })
  @ApiOkResponse({ description: 'Preferences', type: PreferencesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getPreferences(
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PreferencesResponseDto> {
    return this.preferences.get(actor);
  }

  @Put(NOTIFICATION_PREFERENCES_ROUTE)
  @RequirePermissions(Permission.NotificationPreferencesSelf)
  @ApiOperation({ summary: 'Update one notification preference' })
  @ApiOkResponse({ description: 'Preferences', type: PreferencesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PreferencesResponseDto> {
    return this.preferences.update(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.NotificationReadSelf)
  @ApiOperation({ summary: 'List my notifications' })
  @ApiOkResponse({
    description: 'Notifications',
    type: ListNotificationsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listMine(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListNotificationsResponseDto> {
    return this.list.list(actor, resolvePage(query.limit, query.offset));
  }

  @Post(NOTIFICATION_READ_ROUTE)
  @RequirePermissions(Permission.NotificationReadSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one of my notifications as read' })
  @ApiOkResponse({ description: 'Notification', type: NotificationViewDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  markRead(
    @Param(NOTIFICATION_ID_PARAM, UuidValidationPipe) notificationId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<NotificationViewDto> {
    return this.markService.markRead(actor, notificationId);
  }
}
