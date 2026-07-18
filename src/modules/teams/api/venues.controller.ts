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
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ArchiveVenueUseCase } from '../application/archive-venue.use-case';
import { CreateVenueUseCase } from '../application/create-venue.use-case';
import { UpdateVenueUseCase } from '../application/update-venue.use-case';
import { VenueQueryService } from '../application/venue-query.service';
import { resolvePage } from '../lib/teams.helpers';
import {
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
  VENUE_BY_ID_ROUTE,
  VENUE_ID_PARAM,
  VENUES_ROUTE,
} from '../model/teams.constants';
import { CreateVenueDto } from './dto/create-venue.dto';
import { TeamListQueryDto } from './dto/list-query.dto';
import { ListVenuesResponseDto } from './dto/list-venues-response.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueResponseDto } from './dto/venue-response.dto';

@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class VenuesController {
  constructor(
    private readonly createVenue: CreateVenueUseCase,
    private readonly updateVenue: UpdateVenueUseCase,
    private readonly archiveVenue: ArchiveVenueUseCase,
    private readonly venueQuery: VenueQueryService,
  ) {}

  @Post(VENUES_ROUTE)
  @RequirePermissions(Permission.VenueManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a venue within a team' })
  @ApiCreatedResponse({ description: 'Venue created', type: VenueResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateVenueDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VenueResponseDto> {
    return this.createVenue.execute(actor, teamId, {
      name: dto.name,
      address: dto.address ?? null,
      timezone: dto.timezone ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });
  }

  @Get(VENUES_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'List venues for a team' })
  @ApiOkResponse({ description: 'Venues', type: ListVenuesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: TeamListQueryDto,
  ): Promise<ListVenuesResponseDto> {
    return this.venueQuery.listVenues(
      teamId,
      resolvePage(query.limit, query.offset),
    );
  }

  @Patch(VENUE_BY_ID_ROUTE)
  @RequirePermissions(Permission.VenueManage)
  @ApiOperation({ summary: 'Update a venue' })
  @ApiOkResponse({ description: 'Venue updated', type: VenueResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(VENUE_ID_PARAM, UuidValidationPipe) venueId: string,
    @Body() dto: UpdateVenueDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VenueResponseDto> {
    return this.updateVenue.execute(actor, teamId, venueId, {
      name: dto.name,
      address: dto.address ?? null,
      timezone: dto.timezone ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      status: dto.status,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Delete(VENUE_BY_ID_ROUTE)
  @RequirePermissions(Permission.VenueManage)
  @ApiOperation({ summary: 'Archive a venue' })
  @ApiOkResponse({ description: 'Venue archived', type: VenueResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(VENUE_ID_PARAM, UuidValidationPipe) venueId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VenueResponseDto> {
    return this.archiveVenue.execute(actor, teamId, venueId);
  }
}
