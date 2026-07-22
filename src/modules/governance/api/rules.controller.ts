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

import { AcknowledgeRuleUseCase } from '../application/acknowledge-rule.use-case';
import { PublishRuleUseCase } from '../application/publish-rule.use-case';
import { RuleQueryService } from '../application/rule-query.service';
import { resolveGovernancePage } from '../lib/governance.helpers';
import {
  toRuleContent,
  toRuleListFilter,
} from '../lib/governance-command.mapper';
import {
  GOVERNANCE_API_TAG,
  RULE_ACK_ROUTE,
  RULE_ID_PARAM,
  RULE_ITEM_ROUTE,
  RULES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/governance.constants';
import {
  AcknowledgeRuleDto,
  ListTeamRulesResponseDto,
  PublishRuleDto,
  RuleAcknowledgementResponseDto,
  RuleListQueryDto,
  TeamRuleResponseDto,
} from './dto/governance.dto';

/**
 * HTTP surface for versioned team rules: bounded reads (rules.read), publishing
 * the next version and recording an acknowledgement (rules.manage). A rule is
 * never edited — the POST always produces version N+1.
 */
@ApiTags(GOVERNANCE_API_TAG)
@Controller(RULES_ROUTE)
export class RulesController {
  constructor(
    private readonly query: RuleQueryService,
    private readonly publishRule: PublishRuleUseCase,
    private readonly acknowledgeRule: AcknowledgeRuleUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.RulesRead)
  @ApiOperation({ summary: 'List a team’s rules' })
  @ApiOkResponse({ type: ListTeamRulesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: RuleListQueryDto,
  ): Promise<ListTeamRulesResponseDto> {
    return this.query.listForScope(
      teamId,
      toRuleListFilter(query),
      resolveGovernancePage(query.limit, query.offset),
    );
  }

  @Get(RULE_ITEM_ROUTE)
  @RequirePermissions(Permission.RulesRead)
  @ApiOperation({ summary: 'Get one rule version' })
  @ApiOkResponse({ type: TeamRuleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
  ): Promise<TeamRuleResponseDto> {
    return this.query.getById(teamId, ruleId);
  }

  @Post()
  @RequirePermissions(Permission.RulesManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish the next version of a rule' })
  @ApiCreatedResponse({ type: TeamRuleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publish(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: PublishRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamRuleResponseDto> {
    return this.publishRule.execute(actor, teamId, {
      content: toRuleContent(dto),
    });
  }

  @Post(RULE_ACK_ROUTE)
  @RequirePermissions(Permission.RulesRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a rule version' })
  @ApiOkResponse({ type: RuleAcknowledgementResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  acknowledge(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
    @Body() dto: AcknowledgeRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RuleAcknowledgementResponseDto> {
    return this.acknowledgeRule.execute(
      actor,
      teamId,
      ruleId,
      dto.membershipId,
    );
  }
}
