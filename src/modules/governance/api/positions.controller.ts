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

import { DirectoryQueryService } from '../application/directory-query.service';
import { ManageDirectoryUseCase } from '../application/manage-directory.use-case';
import { resolveGovernancePage } from '../lib/governance.helpers';
import {
  toAppointmentContent,
  toPositionContent,
} from '../lib/governance-command.mapper';
import {
  GOVERNANCE_API_TAG,
  POSITION_APPOINTMENT_ROUTE,
  POSITION_ID_PARAM,
  POSITION_ITEM_ROUTE,
  POSITIONS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/governance.constants';
import {
  CreatePositionDto,
  GovernanceAppointmentResponseDto,
  GovernancePageQueryDto,
  GovernancePositionResponseDto,
  ListGovernanceAppointmentsResponseDto,
  ListGovernancePositionsResponseDto,
  RecordAppointmentDto,
} from './dto/governance.dto';

/**
 * HTTP surface for governance titles and appointments (governance.read /
 * governance.manage). A title carries no application permission; assignments are
 * separate. Reads and writes are permissioned so title data cannot be confused
 * with authorization.
 */
@ApiTags(GOVERNANCE_API_TAG)
@Controller(POSITIONS_ROUTE)
export class PositionsController {
  constructor(
    private readonly query: DirectoryQueryService,
    private readonly directory: ManageDirectoryUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.GovernanceRead)
  @ApiOperation({ summary: 'List governance positions' })
  @ApiOkResponse({ type: ListGovernancePositionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: GovernancePageQueryDto,
  ): Promise<ListGovernancePositionsResponseDto> {
    return this.query.listPositions(
      teamId,
      resolveGovernancePage(query.limit, query.offset),
    );
  }

  @Get(POSITION_ITEM_ROUTE)
  @RequirePermissions(Permission.GovernanceRead)
  @ApiOperation({ summary: 'List a position’s appointment history' })
  @ApiOkResponse({ type: ListGovernanceAppointmentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  appointments(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(POSITION_ID_PARAM, UuidValidationPipe) positionId: string,
    @Query() query: GovernancePageQueryDto,
  ): Promise<ListGovernanceAppointmentsResponseDto> {
    return this.query.listAppointments(
      teamId,
      positionId,
      resolveGovernancePage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.GovernanceManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a governance title' })
  @ApiCreatedResponse({ type: GovernancePositionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreatePositionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GovernancePositionResponseDto> {
    return this.directory.createPosition(actor, teamId, {
      content: toPositionContent(dto),
    });
  }

  @Post(POSITION_APPOINTMENT_ROUTE)
  @RequirePermissions(Permission.GovernanceManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record an appointment to a position' })
  @ApiCreatedResponse({ type: GovernanceAppointmentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  appoint(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(POSITION_ID_PARAM, UuidValidationPipe) positionId: string,
    @Body() dto: RecordAppointmentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GovernanceAppointmentResponseDto> {
    return this.directory.recordAppointment(actor, teamId, positionId, {
      content: toAppointmentContent(dto),
    });
  }
}
