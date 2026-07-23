import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiForbiddenResponse,
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
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { PracticeReminderAdminService } from '../application/practice-reminder-admin.service';
import {
  PRACTICE_REMINDER_DISPATCH_ROUTE,
  PRACTICE_REMINDER_PREVIEW_ROUTE,
  PRACTICE_REMINDER_STATUS_ROUTE,
  PRACTICE_REMINDER_TEST_ROUTE,
} from '../model/calendar.constants';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SESSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import {
  ReminderDispatchResponseDto,
  ReminderPreviewResponseDto,
  ReminderTestResponseDto,
} from './dto/reminder-response.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class PracticeReminderAdminController {
  constructor(private readonly reminders: PracticeReminderAdminService) {}

  @Get(PRACTICE_REMINDER_STATUS_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({
    summary: 'Read reminder status for a session (coach, read-only)',
  })
  @ApiOkResponse({ type: ReminderPreviewResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  readStatus(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReminderPreviewResponseDto> {
    return this.reminders.status(actor, teamId, sessionId);
  }

  @Get(PRACTICE_REMINDER_PREVIEW_ROUTE)
  @RequirePermissions(Permission.JobsManage)
  @ApiOperation({ summary: 'Preview due practice reminders' })
  @ApiOkResponse({ type: ReminderPreviewResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  preview(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReminderPreviewResponseDto> {
    return this.reminders.preview(actor, teamId, sessionId);
  }

  @Post(PRACTICE_REMINDER_DISPATCH_ROUTE)
  @RequirePermissions(Permission.JobsManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enqueue due practice reminders' })
  @ApiOkResponse({ type: ReminderDispatchResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  dispatch(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReminderDispatchResponseDto> {
    return this.reminders.dispatch(actor, teamId, sessionId);
  }

  @Post(PRACTICE_REMINDER_TEST_ROUTE)
  @RequirePermissions(Permission.JobsManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enqueue a safe practice reminder test to myself' })
  @ApiOkResponse({ type: ReminderTestResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  sendTest(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReminderTestResponseDto> {
    return this.reminders.sendTest(actor, teamId, sessionId);
  }
}
