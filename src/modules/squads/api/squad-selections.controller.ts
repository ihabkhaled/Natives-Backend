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

import { RemoveSelectionUseCase } from '../application/remove-selection.use-case';
import { SelectPlayerUseCase } from '../application/select-player.use-case';
import { SelectionQueryService } from '../application/selection-query.service';
import { resolveSquadsPage } from '../lib/squads.helpers';
import { toSelectionContent } from '../lib/squads-command.mapper';
import {
  MEMBERSHIP_ID_PARAM,
  SELECTION_OVERRIDE_ROUTE,
  SELECTION_REMOVE_ROUTE,
  SQUAD_ID_PARAM,
  SQUAD_SELECTIONS_ROUTE,
  SQUADS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/squads.constants';
import { ListQueryDto } from './dto/list.query.dto';
import { ListSelectionsResponseDto } from './dto/list-selections.response.dto';
import { OverrideSelectPlayerDto } from './dto/override-select-player.dto';
import { RemoveSelectionDto } from './dto/remove-selection.dto';
import { SelectPlayerDto } from './dto/select-player.dto';
import { SelectionResponseDto } from './dto/selection-response.dto';

/**
 * HTTP surface for squad selection (squad.manage). A clear candidate is selected
 * directly; a candidate an eligibility signal flags is rejected on the plain
 * endpoint and must go through the override endpoint, which additionally requires
 * squad.override_eligibility — the signal is advisory, the decision is a permitted
 * human's, recorded with a reason and audited.
 */
@ApiTags(SQUADS_API_TAG)
@Controller(SQUAD_SELECTIONS_ROUTE)
export class SquadSelectionsController {
  constructor(
    private readonly selectPlayer: SelectPlayerUseCase,
    private readonly removeSelection: RemoveSelectionUseCase,
    private readonly query: SelectionQueryService,
  ) {}

  @Get()
  @RequirePermissions(Permission.SquadRead)
  @ApiOperation({ summary: 'List a squad’s selections' })
  @ApiOkResponse({ type: ListSelectionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Query() query: ListQueryDto,
  ): Promise<ListSelectionsResponseDto> {
    return this.query.listForSquad(
      teamId,
      squadId,
      resolveSquadsPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.SquadManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Select a clear candidate into the squad' })
  @ApiCreatedResponse({ type: SelectionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  select(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Body() dto: SelectPlayerDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SelectionResponseDto> {
    return this.selectPlayer.execute(actor, teamId, squadId, {
      content: toSelectionContent(dto),
      override: null,
    });
  }

  @Post(SELECTION_OVERRIDE_ROUTE)
  @RequirePermissions(
    Permission.SquadManage,
    Permission.SquadOverrideEligibility,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Select a flagged candidate with an explicit override',
  })
  @ApiCreatedResponse({ type: SelectionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  override(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Body() dto: OverrideSelectPlayerDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SelectionResponseDto> {
    return this.selectPlayer.execute(actor, teamId, squadId, {
      content: toSelectionContent(dto),
      override: { overrideReason: dto.overrideReason },
    });
  }

  @Post(SELECTION_REMOVE_ROUTE)
  @RequirePermissions(Permission.SquadManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a player from the squad, keeping history' })
  @ApiOkResponse({ type: SelectionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  remove(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: RemoveSelectionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SelectionResponseDto> {
    return this.removeSelection.execute(actor, teamId, squadId, {
      membershipId,
      reason: dto.reason ?? null,
    });
  }
}
