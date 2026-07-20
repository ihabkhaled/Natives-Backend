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

import { CreateFixtureUseCase } from '../application/create-fixture.use-case';
import { FixtureQueryService } from '../application/fixture-query.service';
import { RescheduleFixtureUseCase } from '../application/reschedule-fixture.use-case';
import { TransitionFixtureUseCase } from '../application/transition-fixture.use-case';
import { resolveCompetitionsPage } from '../lib/competitions.helpers';
import { toFixtureContent } from '../lib/competitions-command.mapper';
import {
  COMPETITION_ID_PARAM,
  COMPETITIONS_API_TAG,
  FIXTURE_ID_PARAM,
  FIXTURE_RESCHEDULE_ROUTE,
  FIXTURE_TRANSITION_ROUTE,
  FIXTURES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/competitions.constants';
import { CreateFixtureDto } from './dto/create-fixture.dto';
import { FixtureResponseDto } from './dto/fixture-response.dto';
import { ListQueryDto } from './dto/list.query.dto';
import { ListFixturesResponseDto } from './dto/list-fixtures.response.dto';
import { RescheduleFixtureDto } from './dto/reschedule-fixture.dto';
import { TransitionFixtureDto } from './dto/transition-fixture.dto';

/**
 * HTTP surface for a competition's fixtures — the schedule shell. A bounded,
 * Cairo-presented read of the calendar (competition.read); booking, rescheduling,
 * and lifecycle transitions (competition.manage). Match play and scoring are later
 * prompts. Identity comes from the token; scope is enforced by the guard and the
 * application layer.
 */
@ApiTags(COMPETITIONS_API_TAG)
@Controller(FIXTURES_ROUTE)
export class FixturesController {
  constructor(
    private readonly query: FixtureQueryService,
    private readonly createFixture: CreateFixtureUseCase,
    private readonly rescheduleFixture: RescheduleFixtureUseCase,
    private readonly transitionFixture: TransitionFixtureUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'List a competition’s fixtures' })
  @ApiOkResponse({ type: ListFixturesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
    @Query() query: ListQueryDto,
  ): Promise<ListFixturesResponseDto> {
    return this.query.listForCompetition(
      teamId,
      competitionId,
      resolveCompetitionsPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book a fixture against an opponent' })
  @ApiCreatedResponse({ type: FixtureResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
    @Body() dto: CreateFixtureDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<FixtureResponseDto> {
    return this.createFixture.execute(actor, teamId, competitionId, {
      content: toFixtureContent(dto),
    });
  }

  @Post(FIXTURE_RESCHEDULE_ROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reschedule a fixture' })
  @ApiOkResponse({ type: FixtureResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reschedule(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
    @Param(FIXTURE_ID_PARAM, UuidValidationPipe) fixtureId: string,
    @Body() dto: RescheduleFixtureDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<FixtureResponseDto> {
    return this.rescheduleFixture.execute(
      actor,
      teamId,
      competitionId,
      fixtureId,
      {
        scheduledAt: dto.scheduledAt,
        venueId: dto.venueId ?? null,
        reason: dto.reason ?? null,
        expectedRecordVersion: dto.expectedRecordVersion,
      },
    );
  }

  @Post(FIXTURE_TRANSITION_ROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ready, start, finalize, abandon, or cancel' })
  @ApiOkResponse({ type: FixtureResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
    @Param(FIXTURE_ID_PARAM, UuidValidationPipe) fixtureId: string,
    @Body() dto: TransitionFixtureDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<FixtureResponseDto> {
    return this.transitionFixture.execute(
      actor,
      teamId,
      competitionId,
      fixtureId,
      {
        transition: dto.transition,
        expectedRecordVersion: dto.expectedRecordVersion,
        reason: dto.reason ?? null,
      },
    );
  }
}
