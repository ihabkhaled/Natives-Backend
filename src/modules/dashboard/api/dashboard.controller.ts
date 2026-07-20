import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { DashboardSummaryService } from '../application/dashboard-summary.service';
import {
  DASHBOARD_API_TAG,
  DASHBOARD_ROUTE,
  DASHBOARD_SUMMARY_ROUTE,
} from '../model/dashboard.constants';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary.query.dto';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';

@ApiTags(DASHBOARD_API_TAG)
@Controller(DASHBOARD_ROUTE)
export class DashboardController {
  constructor(private readonly summary: DashboardSummaryService) {}

  @Get(DASHBOARD_SUMMARY_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({
    summary: 'Permission-aware dashboard summary for the calling principal',
  })
  @ApiOkResponse({
    description: 'Summary projection',
    type: DashboardSummaryResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden, or not a member of the team',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  read(
    @CurrentUser() actor: AuthUserIdentity,
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummaryResponseDto> {
    return this.summary.summarize(actor, query.teamId ?? null);
  }
}
