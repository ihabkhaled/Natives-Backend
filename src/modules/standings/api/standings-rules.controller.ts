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

import { CreateStandingsRuleUseCase } from '../application/create-standings-rule.use-case';
import { StandingsRuleService } from '../application/standings-rule.service';
import { resolveStandingsPage } from '../lib/standings.helpers';
import { toStandingsRuleContent } from '../lib/standings-command.mapper';
import {
  STANDINGS_API_TAG,
  STANDINGS_RULES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/standings.constants';
import {
  CreateStandingsRuleDto,
  ListStandingsRulesResponseDto,
  StandingsPageQueryDto,
  StandingsRuleResponseDto,
} from './dto/standings.dto';

/**
 * HTTP surface for named, versioned standings rules. Reading them is
 * competition.read; publishing the next version is competition.manage. A rule is
 * never edited — the POST always produces version N+1.
 */
@ApiTags(STANDINGS_API_TAG)
@Controller(STANDINGS_RULES_ROUTE)
export class StandingsRulesController {
  constructor(
    private readonly rules: StandingsRuleService,
    private readonly createRule: CreateStandingsRuleUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'List a team’s standings rule versions' })
  @ApiOkResponse({ type: ListStandingsRulesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: StandingsPageQueryDto,
  ): Promise<ListStandingsRulesResponseDto> {
    return this.rules.listForTeam(
      teamId,
      resolveStandingsPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish the next version of a standings rule' })
  @ApiCreatedResponse({ type: StandingsRuleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateStandingsRuleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<StandingsRuleResponseDto> {
    return this.createRule.execute(actor, teamId, {
      content: toStandingsRuleContent(dto),
    });
  }
}
