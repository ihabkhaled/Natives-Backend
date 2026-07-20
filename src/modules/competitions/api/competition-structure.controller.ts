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
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CreateRoundUseCase } from '../application/create-round.use-case';
import { CreateStageUseCase } from '../application/create-stage.use-case';
import { StructureQueryService } from '../application/structure-query.service';
import {
  COMPETITION_CHILD_ROUTE,
  COMPETITION_ID_PARAM,
  COMPETITIONS_API_TAG,
  ROUNDS_SUBROUTE,
  STAGES_SUBROUTE,
  STRUCTURE_SUBROUTE,
  TEAM_ID_PARAM,
} from '../model/competitions.constants';
import { CreateRoundDto } from './dto/create-round.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { RoundResponseDto } from './dto/round-response.dto';
import { StageResponseDto } from './dto/stage-response.dto';
import { StructureResponseDto } from './dto/structure-response.dto';

/**
 * HTTP surface for a competition's stage/round structure: reading it
 * (competition.read) and appending ordered stages and rounds (competition.manage).
 * Identity comes from the token; the team/competition scope is enforced by the
 * permissions guard and the application layer.
 */
@ApiTags(COMPETITIONS_API_TAG)
@Controller(COMPETITION_CHILD_ROUTE)
export class CompetitionStructureController {
  constructor(
    private readonly structure: StructureQueryService,
    private readonly createStage: CreateStageUseCase,
    private readonly createRound: CreateRoundUseCase,
  ) {}

  @Get(STRUCTURE_SUBROUTE)
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'Get a competition’s stages and rounds' })
  @ApiOkResponse({ type: StructureResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
  ): Promise<StructureResponseDto> {
    return this.structure.getStructure(teamId, competitionId);
  }

  @Post(STAGES_SUBROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Append a stage to a competition' })
  @ApiCreatedResponse({ type: StageResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  addStage(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
    @Body() dto: CreateStageDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<StageResponseDto> {
    return this.createStage.execute(actor, teamId, competitionId, {
      content: { name: dto.name, stageFormat: dto.stageFormat },
    });
  }

  @Post(ROUNDS_SUBROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Append a round to a stage' })
  @ApiCreatedResponse({ type: RoundResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  addRound(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
    @Body() dto: CreateRoundDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RoundResponseDto> {
    return this.createRound.execute(actor, teamId, competitionId, {
      content: { stageId: dto.stageId, name: dto.name },
    });
  }
}
