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

import { DeadLetterQueryService } from '../application/dead-letter-query.service';
import { OutboxMetricsService } from '../application/outbox-metrics.service';
import { ReplayDeadLetterUseCase } from '../application/replay-dead-letter.use-case';
import { resolvePage } from '../lib/platform.helpers';
import {
  EVENT_ID_PARAM,
  OUTBOX_ADMIN_API_TAG,
  OUTBOX_ADMIN_ROUTE,
  OUTBOX_DEAD_LETTERS_ROUTE,
  OUTBOX_METRICS_ROUTE,
  OUTBOX_REPLAY_ROUTE,
} from '../model/platform.constants';
import { DeadLetterListResponseDto } from './dto/dead-letter-response.dto';
import { ListDeadLettersQueryDto } from './dto/list-dead-letters.query.dto';
import { OutboxMetricsResponseDto } from './dto/outbox-metrics-response.dto';
import { ReplayResponseDto } from './dto/replay-response.dto';

@ApiTags(OUTBOX_ADMIN_API_TAG)
@Controller(OUTBOX_ADMIN_ROUTE)
export class OutboxAdminController {
  constructor(
    private readonly metrics: OutboxMetricsService,
    private readonly deadLetters: DeadLetterQueryService,
    private readonly replay: ReplayDeadLetterUseCase,
  ) {}

  @Get(OUTBOX_DEAD_LETTERS_ROUTE)
  @RequirePermissions(Permission.JobsManage)
  @ApiOperation({
    summary: 'List dead-lettered events (stable failure codes, no payloads)',
  })
  @ApiOkResponse({
    description: 'Dead-lettered events, newest failure first',
    type: DeadLetterListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listDeadLetters(
    @Query() query: ListDeadLettersQueryDto,
  ): Promise<DeadLetterListResponseDto> {
    return this.deadLetters.list(resolvePage(query.limit, query.offset));
  }

  @Get(OUTBOX_METRICS_ROUTE)
  @RequirePermissions(Permission.JobsManage)
  @ApiOperation({ summary: 'Read outbox health metrics' })
  @ApiOkResponse({ description: 'Metrics', type: OutboxMetricsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  readMetrics(): Promise<OutboxMetricsResponseDto> {
    return this.metrics.read();
  }

  @Post(OUTBOX_REPLAY_ROUTE)
  @RequirePermissions(Permission.JobsManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replay a dead-lettered outbox event' })
  @ApiOkResponse({ description: 'Replayed', type: ReplayResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  replayEvent(
    @Param(EVENT_ID_PARAM, UuidValidationPipe) eventId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReplayResponseDto> {
    return this.replay.execute(actor, eventId);
  }
}
