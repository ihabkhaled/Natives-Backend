import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
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

import { AvailabilityQueryService } from '../application/availability-query.service';
import { DeclareAvailabilityUseCase } from '../application/declare-availability.use-case';
import { resolveSquadsPage } from '../lib/squads.helpers';
import {
  SQUAD_AVAILABILITY_ROUTE,
  SQUAD_ID_PARAM,
  SQUADS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/squads.constants';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { DeclareAvailabilityDto } from './dto/declare-availability.dto';
import { ListQueryDto } from './dto/list.query.dto';
import { ListAvailabilityResponseDto } from './dto/list-availability.response.dto';

/**
 * HTTP surface for squad availability (squad.read). A member declares their own
 * availability for the squad's competition/period — the membership is resolved
 * from the authenticated token, never the body — and a bounded list is exposed to
 * the coach as one eligibility signal input among many.
 */
@ApiTags(SQUADS_API_TAG)
@Controller(SQUAD_AVAILABILITY_ROUTE)
export class SquadAvailabilityController {
  constructor(
    private readonly declareAvailability: DeclareAvailabilityUseCase,
    private readonly query: AvailabilityQueryService,
  ) {}

  @Get()
  @RequirePermissions(Permission.SquadRead)
  @ApiOperation({ summary: 'List a squad’s availability declarations' })
  @ApiOkResponse({ type: ListAvailabilityResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Query() query: ListQueryDto,
  ): Promise<ListAvailabilityResponseDto> {
    return this.query.listForSquad(
      teamId,
      squadId,
      resolveSquadsPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.SquadRead)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Declare your own availability for the squad' })
  @ApiCreatedResponse({ type: AvailabilityResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  declare(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Body() dto: DeclareAvailabilityDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AvailabilityResponseDto> {
    return this.declareAvailability.execute(actor, teamId, squadId, {
      availability: dto.availability,
      reason: dto.reason ?? null,
    });
  }
}
