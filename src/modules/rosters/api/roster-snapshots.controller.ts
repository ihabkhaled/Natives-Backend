import { RequirePermissions } from '@core/auth';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { RosterSnapshotQueryService } from '../application/roster-snapshot-query.service';
import { resolveEntriesPage } from '../lib/rosters.helpers';
import {
  ROSTER_ID_PARAM,
  ROSTER_SNAPSHOTS_ROUTE,
  ROSTERS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/rosters.constants';
import { ListRosterSnapshotsResponseDto } from './dto/list-roster-snapshots.response.dto';
import { RosterPageQueryDto } from './dto/roster-page.query.dto';

/**
 * Read-only HTTP surface for a roster's immutable snapshots (roster.read). There
 * is deliberately no write route: snapshots are produced by the publish, lock,
 * and revision flows and can never be edited or deleted through the API.
 */
@ApiTags(ROSTERS_API_TAG)
@Controller(ROSTER_SNAPSHOTS_ROUTE)
export class RosterSnapshotsController {
  constructor(private readonly query: RosterSnapshotQueryService) {}

  @Get()
  @RequirePermissions(Permission.RosterRead)
  @ApiOperation({ summary: 'List a roster’s immutable snapshots' })
  @ApiOkResponse({ type: ListRosterSnapshotsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Query() query: RosterPageQueryDto,
  ): Promise<ListRosterSnapshotsResponseDto> {
    return this.query.listForRoster(
      teamId,
      rosterId,
      resolveEntriesPage(query.limit, query.offset),
    );
  }
}
