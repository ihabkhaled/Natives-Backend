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

import { CreatePointsRuleUseCase } from '../application/create-points-rule.use-case';
import { RuleQueryService } from '../application/rule-query.service';
import { TransitionPointsRuleUseCase } from '../application/transition-points-rule.use-case';
import { resolvePointsPage } from '../lib/points.helpers';
import { toRuleContent } from '../lib/points-command.mapper';
import {
  POINTS_API_TAG,
  POINTS_RULES_ROUTE,
  RULE_ID_PARAM,
  RULE_TRANSITION_ROUTE,
  TEAM_ID_PARAM,
} from '../model/points.constants';
import { CreatePointsRuleDto } from './dto/create-rule.dto';
import { ListPointsQueryDto } from './dto/list-points.query.dto';
import { PointsListRulesResponseDto } from './dto/list-rules.response.dto';
import { PointsRuleResponseDto } from './dto/rule-response.dto';
import { PointsTransitionRuleDto } from './dto/transition-rule.dto';

/**
 * Admin surface for versioned points rules (points.rules.manage): draft creation,
 * an approve → publish → retire lifecycle, and a bounded listing that surfaces the
 * seeded global candidates. A rule is never effective until published; the legacy
 * external-training values live here as a seeded draft candidate, never hard-coded.
 */
@ApiTags(POINTS_API_TAG)
@Controller(POINTS_RULES_ROUTE)
export class PointsRuleController {
  constructor(
    private readonly query: RuleQueryService,
    private readonly createRule: CreatePointsRuleUseCase,
    private readonly transitionRule: TransitionPointsRuleUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.PointsRulesManage)
  @ApiOperation({ summary: 'List a team’s points rules and candidates' })
  @ApiOkResponse({ type: PointsListRulesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListPointsQueryDto,
  ): Promise<PointsListRulesResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolvePointsPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.PointsRulesManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft points rule' })
  @ApiCreatedResponse({ type: PointsRuleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreatePointsRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PointsRuleResponseDto> {
    return this.createRule.execute(actor, teamId, {
      content: toRuleContent(dto),
    });
  }

  @Post(RULE_TRANSITION_ROUTE)
  @RequirePermissions(Permission.PointsRulesManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve, publish, revert, or retire a rule' })
  @ApiOkResponse({ type: PointsRuleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
    @Body() dto: PointsTransitionRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PointsRuleResponseDto> {
    return this.transitionRule.execute(actor, teamId, ruleId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
