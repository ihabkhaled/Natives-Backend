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
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CreateCalculationRuleUseCase } from '../application/create-calculation-rule.use-case';
import { RuleQueryService } from '../application/rule-query.service';
import { SimulateCalculationRuleUseCase } from '../application/simulate-calculation-rule.use-case';
import { TransitionCalculationRuleUseCase } from '../application/transition-calculation-rule.use-case';
import { UpdateCalculationRuleUseCase } from '../application/update-calculation-rule.use-case';
import { resolveScoringPage } from '../lib/scoring.helpers';
import { toRuleContent } from '../lib/scoring-command.mapper';
import {
  CALCULATION_RULES_ROUTE,
  RULE_DETAIL_ROUTE,
  RULE_ID_PARAM,
  RULE_SIMULATE_ROUTE,
  RULE_TRANSITION_ROUTE,
  SCORING_API_TAG,
  TEAM_ID_PARAM,
} from '../model/scoring.constants';
import { CreateScoringRuleDto } from './dto/create-rule.dto';
import { ListRulesResponseDto } from './dto/list-rules.response.dto';
import { ListScoringQueryDto } from './dto/list-scoring.query.dto';
import { ScoringRuleResponseDto } from './dto/rule-response.dto';
import { SimulateRuleDto } from './dto/simulate-rule.dto';
import { SimulationResponseDto } from './dto/simulation-response.dto';
import { TransitionRuleDto } from './dto/transition-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

/**
 * Admin surface for versioned calculation rules (points.rules.manage): draft
 * CRUD, an approve → publish → retire lifecycle, and a dry-run simulation that
 * writes nothing. A rule is never active until published; the legacy equal-weight
 * formula lives here as a seeded draft candidate, never as hard-coded logic.
 */
@ApiTags(SCORING_API_TAG)
@Controller(CALCULATION_RULES_ROUTE)
export class CalculationRuleController {
  constructor(
    private readonly query: RuleQueryService,
    private readonly createRule: CreateCalculationRuleUseCase,
    private readonly updateRule: UpdateCalculationRuleUseCase,
    private readonly transitionRule: TransitionCalculationRuleUseCase,
    private readonly simulateRule: SimulateCalculationRuleUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.PointsRulesManage)
  @ApiOperation({ summary: 'List a team’s calculation rules and candidates' })
  @ApiOkResponse({ type: ListRulesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListScoringQueryDto,
  ): Promise<ListRulesResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveScoringPage(query.limit, query.offset),
    );
  }

  @Get(RULE_DETAIL_ROUTE)
  @RequirePermissions(Permission.PointsRulesManage)
  @ApiOperation({ summary: 'Read one calculation rule with its components' })
  @ApiOkResponse({ type: ScoringRuleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
  ): Promise<ScoringRuleResponseDto> {
    return this.query.getDetail(teamId, ruleId);
  }

  @Post()
  @RequirePermissions(Permission.PointsRulesManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft calculation rule' })
  @ApiCreatedResponse({ type: ScoringRuleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateScoringRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScoringRuleResponseDto> {
    return this.createRule.execute(actor, teamId, {
      content: toRuleContent(dto),
    });
  }

  @Put(RULE_DETAIL_ROUTE)
  @RequirePermissions(Permission.PointsRulesManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a draft calculation rule' })
  @ApiOkResponse({ type: ScoringRuleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScoringRuleResponseDto> {
    return this.updateRule.execute(actor, teamId, ruleId, {
      expectedRecordVersion: dto.expectedRecordVersion,
      content: toRuleContent(dto),
    });
  }

  @Post(RULE_TRANSITION_ROUTE)
  @RequirePermissions(Permission.PointsRulesManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve, publish, revert, or retire a rule' })
  @ApiOkResponse({ type: ScoringRuleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
    @Body() dto: TransitionRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScoringRuleResponseDto> {
    return this.transitionRule.execute(actor, teamId, ruleId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(RULE_SIMULATE_ROUTE)
  @RequirePermissions(Permission.PointsRulesManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dry-run a rule for a member (writes nothing)' })
  @ApiOkResponse({ type: SimulationResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  simulate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
    @Body() dto: SimulateRuleDto,
  ): Promise<SimulationResponseDto> {
    return this.simulateRule.execute(teamId, ruleId, {
      membershipId: dto.membershipId,
    });
  }
}
