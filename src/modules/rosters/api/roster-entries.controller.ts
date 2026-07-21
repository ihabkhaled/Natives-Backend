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

import { AddRosterEntryUseCase } from '../application/add-roster-entry.use-case';
import { RemoveRosterEntryUseCase } from '../application/remove-roster-entry.use-case';
import { RosterEntryQueryService } from '../application/roster-entry-query.service';
import { resolveEntriesPage } from '../lib/rosters.helpers';
import { toRosterEntryContent } from '../lib/rosters-command.mapper';
import {
  ENTRY_OVERRIDE_ROUTE,
  ENTRY_REMOVE_ROUTE,
  MEMBERSHIP_ID_PARAM,
  ROSTER_ENTRIES_ROUTE,
  ROSTER_ID_PARAM,
  ROSTERS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/rosters.constants';
import { AddRosterEntryDto } from './dto/add-roster-entry.dto';
import { ListRosterEntriesResponseDto } from './dto/list-roster-entries.response.dto';
import { OverrideRosterEntryDto } from './dto/override-roster-entry.dto';
import { RemoveRosterEntryDto } from './dto/remove-roster-entry.dto';
import { CompetitionRosterEntryResponseDto } from './dto/roster-entry-response.dto';
import { RosterPageQueryDto } from './dto/roster-page.query.dto';

/**
 * HTTP surface for roster entries (roster.manage). A candidate no rule flags is
 * added directly; a flagged one is refused on the plain endpoint and must go
 * through the override endpoint, which additionally requires the elevated
 * eligibility-override permission — the flag is advisory, the decision is a
 * permitted human's, recorded with a reason and audited. Removal is a soft
 * withdrawal so history is never deleted.
 */
@ApiTags(ROSTERS_API_TAG)
@Controller(ROSTER_ENTRIES_ROUTE)
export class RosterEntriesController {
  constructor(
    private readonly addEntry: AddRosterEntryUseCase,
    private readonly removeEntry: RemoveRosterEntryUseCase,
    private readonly query: RosterEntryQueryService,
  ) {}

  @Get()
  @RequirePermissions(Permission.RosterRead)
  @ApiOperation({ summary: 'List every roster entry, active and withdrawn' })
  @ApiOkResponse({ type: ListRosterEntriesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Query() query: RosterPageQueryDto,
  ): Promise<ListRosterEntriesResponseDto> {
    return this.query.listForRoster(
      teamId,
      rosterId,
      resolveEntriesPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.RosterManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an unflagged player to the roster' })
  @ApiCreatedResponse({ type: CompetitionRosterEntryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  add(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Body() dto: AddRosterEntryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CompetitionRosterEntryResponseDto> {
    return this.addEntry.execute(actor, teamId, rosterId, {
      content: toRosterEntryContent(dto),
      override: null,
    });
  }

  @Post(ENTRY_OVERRIDE_ROUTE)
  @RequirePermissions(
    Permission.RosterManage,
    Permission.SquadOverrideEligibility,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a flagged player with an explicit override' })
  @ApiCreatedResponse({ type: CompetitionRosterEntryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  override(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Body() dto: OverrideRosterEntryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CompetitionRosterEntryResponseDto> {
    return this.addEntry.execute(actor, teamId, rosterId, {
      content: toRosterEntryContent(dto),
      override: { overrideReason: dto.overrideReason },
    });
  }

  @Post(ENTRY_REMOVE_ROUTE)
  @RequirePermissions(Permission.RosterManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw a player, keeping the entry as history' })
  @ApiOkResponse({ type: CompetitionRosterEntryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  remove(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: RemoveRosterEntryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CompetitionRosterEntryResponseDto> {
    return this.removeEntry.execute(actor, teamId, rosterId, {
      membershipId,
      reason: dto.reason ?? null,
    });
  }
}
