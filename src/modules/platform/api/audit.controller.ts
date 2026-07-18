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

import { AuditQueryService } from '../application/audit-query.service';
import { resolvePage } from '../lib/platform.helpers';
import {
  AUDIT_API_TAG,
  AUDIT_ROUTE,
  TEAM_ID_PARAM,
} from '../model/platform.constants';
import { AuditQueryDto } from './dto/audit-query.dto';
import { ListAuditResponseDto } from './dto/audit-response.dto';

@ApiTags(AUDIT_API_TAG)
@Controller(AUDIT_ROUTE)
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @RequirePermissions(Permission.AuditRead)
  @ApiOperation({ summary: 'Read the team audit ledger' })
  @ApiOkResponse({ description: 'Audit entries', type: ListAuditResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: AuditQueryDto,
  ): Promise<ListAuditResponseDto> {
    return this.audit.listForTeam(
      teamId,
      resolvePage(query.limit, query.offset),
    );
  }
}
