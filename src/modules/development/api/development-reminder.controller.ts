import { RequirePermissions } from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { EnqueueDevelopmentRemindersUseCase } from '../application/enqueue-development-reminders.use-case';
import {
  DEVELOPMENT_API_TAG,
  DEVELOPMENT_REMINDERS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/development.constants';
import { RemindersResponseDto } from './dto/reminders-response.dto';

/**
 * Triggers a privacy-safe reminder scan for a team: it queues one reminder event
 * per unacknowledged shared feedback and per overdue active goal. Restricted to
 * feedback managers; payloads carry identifiers only, never private content.
 */
@ApiTags(DEVELOPMENT_API_TAG)
@Controller(DEVELOPMENT_REMINDERS_ROUTE)
export class DevelopmentReminderController {
  constructor(private readonly reminders: EnqueueDevelopmentRemindersUseCase) {}

  @Post()
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Queue reminders for unacknowledged feedback and overdue goals',
  })
  @ApiCreatedResponse({ type: RemindersResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  enqueue(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
  ): Promise<RemindersResponseDto> {
    return this.reminders.execute(teamId);
  }
}
