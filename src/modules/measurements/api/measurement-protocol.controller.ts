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
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CreateMeasurementProtocolUseCase } from '../application/create-measurement-protocol.use-case';
import { ProtocolQueryService } from '../application/protocol-query.service';
import { resolveMeasurementsPage } from '../lib/measurements.helpers';
import { toProtocolContent } from '../lib/measurements-command.mapper';
import {
  MEASUREMENT_PROTOCOLS_ROUTE,
  MEASUREMENTS_API_TAG,
  PROTOCOL_DETAIL_ROUTE,
  PROTOCOL_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/measurements.constants';
import { CreateProtocolDto } from './dto/create-protocol.dto';
import { ListMeasurementsQueryDto } from './dto/list-measurements.query.dto';
import { ListProtocolsResponseDto } from './dto/list-protocols.response.dto';
import { ProtocolResponseDto } from './dto/protocol-response.dto';

/**
 * The measurement-protocol catalog surface. Reads are gated by
 * analytics.read.team; creating an objective protocol requires measurement.record.
 * A team sees its own protocols plus the seeded global catalog.
 */
@ApiTags(MEASUREMENTS_API_TAG)
@Controller(MEASUREMENT_PROTOCOLS_ROUTE)
export class MeasurementProtocolController {
  constructor(
    private readonly query: ProtocolQueryService,
    private readonly createProtocol: CreateMeasurementProtocolUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'List a team’s measurement protocols' })
  @ApiOkResponse({ type: ListProtocolsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListMeasurementsQueryDto,
  ): Promise<ListProtocolsResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveMeasurementsPage(query.limit, query.offset),
    );
  }

  @Get(PROTOCOL_DETAIL_ROUTE)
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'Read one measurement protocol' })
  @ApiOkResponse({ type: ProtocolResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(PROTOCOL_ID_PARAM, UuidValidationPipe) protocolId: string,
  ): Promise<ProtocolResponseDto> {
    return this.query.getDetail(teamId, protocolId);
  }

  @Post()
  @RequirePermissions(Permission.MeasurementRecord)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a measurement protocol' })
  @ApiCreatedResponse({ type: ProtocolResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateProtocolDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ProtocolResponseDto> {
    return this.createProtocol.execute(actor, teamId, {
      content: toProtocolContent(dto),
    });
  }
}
