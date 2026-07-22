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

import { JerseyQueryService } from '../application/jersey-query.service';
import { ManageReservationUseCase } from '../application/manage-reservation.use-case';
import { resolveJerseysPage } from '../lib/jerseys.helpers';
import {
  toReservationContent,
  toReservationListFilter,
} from '../lib/jerseys-command.mapper';
import {
  JERSEYS_API_TAG,
  RESERVATION_ID_PARAM,
  RESERVATION_RELEASE_ROUTE,
  RESERVATIONS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/jerseys.constants';
import {
  CreateReservationDto,
  ListNumberReservationsResponseDto,
  NumberReservationResponseDto,
  ReleaseReservationDto,
  ReservationListQueryDto,
} from './dto/jerseys.dto';

/**
 * HTTP surface for scoped shirt-number reservations (jersey.read /
 * jersey.manage). A number is unique per team/season/division while active; a
 * release keeps the used-number history.
 */
@ApiTags(JERSEYS_API_TAG)
@Controller(RESERVATIONS_ROUTE)
export class NumberReservationsController {
  constructor(
    private readonly query: JerseyQueryService,
    private readonly reservations: ManageReservationUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.JerseyRead)
  @ApiOperation({ summary: 'List number reservations' })
  @ApiOkResponse({ type: ListNumberReservationsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ReservationListQueryDto,
  ): Promise<ListNumberReservationsResponseDto> {
    return this.query.listReservations(
      teamId,
      toReservationListFilter(query),
      resolveJerseysPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.JerseyManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reserve a shirt number' })
  @ApiCreatedResponse({ type: NumberReservationResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateReservationDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<NumberReservationResponseDto> {
    return this.reservations.create(actor, teamId, {
      content: toReservationContent(dto),
    });
  }

  @Post(RESERVATION_RELEASE_ROUTE)
  @RequirePermissions(Permission.JerseyManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release a shirt number' })
  @ApiOkResponse({ type: NumberReservationResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  release(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RESERVATION_ID_PARAM, UuidValidationPipe) reservationId: string,
    @Body() dto: ReleaseReservationDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<NumberReservationResponseDto> {
    return this.reservations.release(actor, teamId, reservationId, {
      reason: dto.reason,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
