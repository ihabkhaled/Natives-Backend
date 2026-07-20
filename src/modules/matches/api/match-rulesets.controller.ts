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

import { CreateMatchRulesetUseCase } from '../application/create-match-ruleset.use-case';
import { MatchRulesetQueryService } from '../application/match-ruleset-query.service';
import { resolveMatchesPage } from '../lib/matches.helpers';
import { toMatchRulesetContent } from '../lib/matches-command.mapper';
import {
  MATCH_RULESETS_ROUTE,
  MATCHES_API_TAG,
  TEAM_ID_PARAM,
} from '../model/matches.constants';
import { CreateMatchRulesetDto } from './dto/create-match-ruleset.dto';
import { ListMatchRulesetsResponseDto } from './dto/list-match-rulesets.response.dto';
import { MatchListQueryDto } from './dto/match-list.query.dto';
import { MatchRulesetResponseDto } from './dto/match-ruleset-response.dto';

/**
 * HTTP surface for the VERSIONED scoring rule sets: reading every published
 * version (match.read) and publishing a new one (match.manage). Publishing never
 * edits an existing version — it inserts the next one and archives the previous
 * active one — so a historical match stays explainable under exactly the caps and
 * targets it was played under.
 */
@ApiTags(MATCHES_API_TAG)
@Controller(MATCH_RULESETS_ROUTE)
export class MatchRulesetsController {
  constructor(
    private readonly query: MatchRulesetQueryService,
    private readonly createRuleset: CreateMatchRulesetUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.MatchRead)
  @ApiOperation({ summary: 'List every published scoring rule set version' })
  @ApiOkResponse({ type: ListMatchRulesetsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: MatchListQueryDto,
  ): Promise<ListMatchRulesetsResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveMatchesPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.MatchManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a new version of a scoring rule set' })
  @ApiCreatedResponse({ type: MatchRulesetResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateMatchRulesetDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchRulesetResponseDto> {
    return this.createRuleset.execute(actor, teamId, {
      content: toMatchRulesetContent(dto),
    });
  }
}
