import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AgendaBlockService } from '../application/agenda-block.service';
import { AgendaStationService } from '../application/agenda-station.service';
import { ReorderAgendaBlocksUseCase } from '../application/reorder-agenda-blocks.use-case';
import {
  AGENDA_BLOCK_BY_ID_ROUTE,
  AGENDA_BLOCK_COMPLETE_ROUTE,
  AGENDA_BLOCK_REORDER_ROUTE,
  AGENDA_BLOCKS_ROUTE,
  AGENDA_STATION_BY_ID_ROUTE,
  AGENDA_STATIONS_ROUTE,
  BLOCK_ID_PARAM,
  STATION_ID_PARAM,
} from '../model/agendas.constants';
import { AgendaBlockType } from '../model/agendas.enums';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SESSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { AgendaSummaryResponseDto } from './dto/agenda-summary-response.dto';
import { BlockResponseDto } from './dto/block-response.dto';
import { CompleteBlockDto } from './dto/complete-block.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateStationDto } from './dto/create-station.dto';
import { ReorderBlocksDto } from './dto/reorder-blocks.dto';
import { StationResponseDto } from './dto/station-response.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class AgendaBlockController {
  constructor(
    private readonly blocks: AgendaBlockService,
    private readonly reorder: ReorderAgendaBlocksUseCase,
    private readonly stations: AgendaStationService,
  ) {}

  @Post(AGENDA_BLOCKS_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Append an ordered block to a draft agenda' })
  @ApiCreatedResponse({ description: 'Added', type: BlockResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  addBlock(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<BlockResponseDto> {
    return this.blocks.addBlock(actor, teamId, sessionId, {
      drillId: dto.drillId ?? null,
      title: dto.title,
      blockType: dto.blockType ?? AgendaBlockType.Drill,
      offsetMinutes: dto.offsetMinutes ?? null,
      durationMinutes: dto.durationMinutes ?? null,
      intensity: dto.intensity ?? null,
      repetitions: dto.repetitions ?? null,
      target: dto.target ?? null,
      notes: dto.notes ?? null,
      coachNotes: dto.coachNotes ?? null,
    });
  }

  @Post(AGENDA_BLOCK_REORDER_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Reorder agenda blocks (optimistic concurrency)' })
  @ApiOkResponse({ description: 'Reordered', type: AgendaSummaryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reorderBlocks(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: ReorderBlocksDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AgendaSummaryResponseDto> {
    return this.reorder.execute(actor, teamId, sessionId, {
      blockIds: dto.blockIds,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Patch(AGENDA_BLOCK_BY_ID_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Update an agenda block' })
  @ApiOkResponse({ description: 'Updated', type: BlockResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  updateBlock(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(BLOCK_ID_PARAM, UuidValidationPipe) blockId: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<BlockResponseDto> {
    return this.blocks.updateBlock(actor, teamId, sessionId, blockId, {
      drillId: dto.drillId ?? null,
      title: dto.title,
      blockType: dto.blockType ?? AgendaBlockType.Drill,
      offsetMinutes: dto.offsetMinutes ?? null,
      durationMinutes: dto.durationMinutes ?? null,
      intensity: dto.intensity ?? null,
      repetitions: dto.repetitions ?? null,
      target: dto.target ?? null,
      notes: dto.notes ?? null,
      coachNotes: dto.coachNotes ?? null,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Post(AGENDA_BLOCK_COMPLETE_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: "Record a block's execution/completion" })
  @ApiOkResponse({ description: 'Recorded', type: BlockResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  completeBlock(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(BLOCK_ID_PARAM, UuidValidationPipe) blockId: string,
    @Body() dto: CompleteBlockDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<BlockResponseDto> {
    return this.blocks.completeBlock(actor, teamId, sessionId, blockId, {
      completionStatus: dto.completionStatus,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Delete(AGENDA_BLOCK_BY_ID_ROUTE)
  @HttpCode(204)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Remove a block from a draft agenda' })
  @ApiNoContentResponse({ description: 'Removed' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  removeBlock(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(BLOCK_ID_PARAM, UuidValidationPipe) blockId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<void> {
    return this.blocks.removeBlock(actor, teamId, sessionId, blockId);
  }

  @Post(AGENDA_STATIONS_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Add a station under an agenda block' })
  @ApiCreatedResponse({ description: 'Added', type: StationResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  addStation(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(BLOCK_ID_PARAM, UuidValidationPipe) blockId: string,
    @Body() dto: CreateStationDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<StationResponseDto> {
    return this.stations.addStation(actor, teamId, sessionId, blockId, {
      drillId: dto.drillId ?? null,
      groupId: dto.groupId ?? null,
      coachMembershipId: dto.coachMembershipId ?? null,
      name: dto.name,
      repetitions: dto.repetitions ?? null,
      target: dto.target ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Delete(AGENDA_STATION_BY_ID_ROUTE)
  @HttpCode(204)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Remove a station from a draft agenda' })
  @ApiNoContentResponse({ description: 'Removed' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  removeStation(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(BLOCK_ID_PARAM, UuidValidationPipe) blockId: string,
    @Param(STATION_ID_PARAM, UuidValidationPipe) stationId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<void> {
    return this.stations.removeStation(
      actor,
      teamId,
      sessionId,
      blockId,
      stationId,
    );
  }
}
