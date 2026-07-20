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

import { DeclareRosterAvailabilityUseCase } from '../application/declare-roster-availability.use-case';
import { RosterAvailabilityQueryService } from '../application/roster-availability-query.service';
import { resolveEntriesPage } from '../lib/rosters.helpers';
import {
  ROSTER_AVAILABILITY_ROUTE,
  ROSTER_ID_PARAM,
  ROSTERS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/rosters.constants';
import { DeclareRosterAvailabilityDto } from './dto/declare-roster-availability.dto';
import { ListRosterAvailabilityResponseDto } from './dto/list-roster-availability.response.dto';
import { RosterAvailabilityResponseDto } from './dto/roster-availability-response.dto';
import { RosterPageQueryDto } from './dto/roster-page.query.dto';

/**
 * HTTP surface for roster availability (roster.read). A member declares only for
 * themselves: the membership is resolved from the authenticated token, never from
 * the body. The window closes when the roster locks or its deadline passes.
 */
@ApiTags(ROSTERS_API_TAG)
@Controller(ROSTER_AVAILABILITY_ROUTE)
export class RosterAvailabilityController {
  constructor(
    private readonly declareAvailability: DeclareRosterAvailabilityUseCase,
    private readonly query: RosterAvailabilityQueryService,
  ) {}

  @Get()
  @RequirePermissions(Permission.RosterRead)
  @ApiOperation({ summary: 'List a roster’s availability declarations' })
  @ApiOkResponse({ type: ListRosterAvailabilityResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Query() query: RosterPageQueryDto,
  ): Promise<ListRosterAvailabilityResponseDto> {
    return this.query.listForRoster(
      teamId,
      rosterId,
      resolveEntriesPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.RosterRead)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Declare your own availability for a roster' })
  @ApiCreatedResponse({ type: RosterAvailabilityResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  declare(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Body() dto: DeclareRosterAvailabilityDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RosterAvailabilityResponseDto> {
    return this.declareAvailability.execute(actor, teamId, rosterId, {
      availability: dto.availability,
      reason: dto.reason ?? null,
    });
  }
}
