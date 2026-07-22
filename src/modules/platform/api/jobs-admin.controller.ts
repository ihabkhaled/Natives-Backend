import { RequirePermissions } from '@core/auth';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { Controller, Get } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { JobsHealthService } from '../application/jobs-health.service';
import {
  JOBS_ADMIN_API_TAG,
  JOBS_ADMIN_ROUTE,
  JOBS_HEALTH_ROUTE,
} from '../model/platform.constants';
import { JobHealthListResponseDto } from './dto/jobs-health-response.dto';

@ApiTags(JOBS_ADMIN_API_TAG)
@Controller(JOBS_ADMIN_ROUTE)
export class JobsAdminController {
  constructor(private readonly jobsHealth: JobsHealthService) {}

  @Get(JOBS_HEALTH_ROUTE)
  @RequirePermissions(Permission.JobsManage)
  @ApiOperation({
    summary: 'Read the recorded health of every registered scheduled job',
  })
  @ApiOkResponse({
    description: 'Job health derived from recorded heartbeats',
    type: JobHealthListResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  health(): Promise<JobHealthListResponseDto> {
    return this.jobsHealth.read();
  }
}
