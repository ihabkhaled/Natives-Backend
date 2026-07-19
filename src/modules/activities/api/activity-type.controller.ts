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

import { ActivityCatalogService } from '../application/activity-catalog.service';
import { resolveActivityPage } from '../lib/activity.helpers';
import {
  ACTIVITIES_API_TAG,
  ACTIVITY_TYPES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/activities.constants';
import { ListActivitiesQueryDto } from './dto/list-activities.query.dto';
import { ListActivityTypesResponseDto } from './dto/list-activity-types.response.dto';

/**
 * Read the versioned activity-type catalog (point-value candidates per type; WFDF
 * and custom types show a null, pending value). Available to any member so they
 * can choose what to submit.
 */
@ApiTags(ACTIVITIES_API_TAG)
@Controller(ACTIVITY_TYPES_ROUTE)
export class ActivityTypeController {
  constructor(private readonly catalog: ActivityCatalogService) {}

  @Get()
  @RequirePermissions(Permission.ActivityReadSelf)
  @ApiOperation({ summary: 'List the active external-training activity types' })
  @ApiOkResponse({ type: ListActivityTypesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListActivitiesQueryDto,
  ): Promise<ListActivityTypesResponseDto> {
    return this.catalog.listActiveTypes(
      teamId,
      resolveActivityPage(query.limit, query.offset),
    );
  }
}
