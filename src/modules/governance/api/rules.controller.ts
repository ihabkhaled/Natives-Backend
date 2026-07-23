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
  RULE_ACK_LIST_ROUTE,
  RULE_ACK_ROUTE,
  RULE_ID_PARAM,
  RULE_ITEM_ROUTE,
  RULES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/governance.constants';
import {
  AcknowledgeRuleDto,
  GovernancePageQueryDto,
  ListRuleAcknowledgementsResponseDto,
  ListTeamRulesResponseDto,
  PublishRuleDto,
  RuleAcknowledgementResponseDto,
  RuleListQueryDto,
  TeamRuleResponseDto,
  TeamRuleWithAckStateResponseDto,
} from './dto/governance.dto';

/**
 * HTTP surface for versioned team rules: bounded reads carrying the caller's
 * own acknowledgement state (rules.read), publishing the next version
 * (rules.manage), recording a SELF acknowledgement (rules.read, self-scoped to
 * the actor's own membership), and the admin compliance listing of one
 * version's acknowledgements (rules.manage). A rule is never edited — the POST
 * always produces version N+1.
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
  @ApiOperation({
    summary: 'List a team’s rules',
    description:
      'Each item carries myAcknowledgedVersion/myAcknowledgedAt — the ' +
      'caller’s own acknowledgement state of that version row, resolved from ' +
      'their active membership (null when they hold none).',
  })
  @ApiOkResponse({ type: ListTeamRulesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: RuleListQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListTeamRulesResponseDto> {
    return this.query.listForScope(
      teamId,
      actor,
      toRuleListFilter(query),
      resolveGovernancePage(query.limit, query.offset),
    );
  }

  @Get(RULE_ITEM_ROUTE)
  @RequirePermissions(Permission.RulesRead)
  @ApiOperation({
    summary: 'Get one rule version with the caller’s acknowledgement state',
  })
  @ApiOkResponse({ type: TeamRuleWithAckStateResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamRuleWithAckStateResponseDto> {
    return this.query.getById(teamId, actor, ruleId);
  }

  @Get(RULE_ACK_LIST_ROUTE)
  @RequirePermissions(Permission.RulesManage)
  @ApiOperation({
    summary: 'List one rule version’s acknowledgements (compliance)',
    description:
      'Bounded page of the memberships that acknowledged this exact version, ' +
      'newest first — the admin compliance grid read.',
  })
  @ApiOkResponse({ type: ListRuleAcknowledgementsResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listAcknowledgements(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RULE_ID_PARAM, UuidValidationPipe) ruleId: string,
    @Query() query: GovernancePageQueryDto,
  ): Promise<ListRuleAcknowledgementsResponseDto> {
    return this.query.listAcknowledgements(
      teamId,
      ruleId,
      resolveGovernancePage(query.limit, query.offset),
    );
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
  @ApiOperation({
    summary: 'Acknowledge a rule version (self only)',
    description:
      'Idempotent upsert of the caller’s own acknowledgement. The membership ' +
      'must belong to the acting user; a third-party membership is a 403 ' +
      'with messageKey errors.governance.acknowledgementForbidden.',
  })
  @ApiOkResponse({ type: RuleAcknowledgementResponseDto })
  @ApiForbiddenResponse({
    description:
      'Forbidden — the membership does not belong to the acting user ' +
      '(errors.governance.acknowledgementForbidden)',
  })
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
