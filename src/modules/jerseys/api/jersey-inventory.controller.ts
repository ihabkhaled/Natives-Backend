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

import { IssueStockUseCase } from '../application/issue-stock.use-case';
import { JerseyQueryService } from '../application/jersey-query.service';
import { resolveJerseysPage } from '../lib/jerseys.helpers';
import { toIssueContent } from '../lib/jerseys-command.mapper';
import {
  INVENTORY_ISSUE_ROUTE,
  INVENTORY_ROUTE,
  JERSEYS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/jerseys.constants';
import {
  IssueStockDto,
  JerseyInventoryResponseDto,
  JerseyPageQueryDto,
  ListJerseyInventoryResponseDto,
} from './dto/jerseys.dto';

/**
 * HTTP surface for jersey inventory and issue/return (jersey.read /
 * jersey.manage). Issuing records that a specific member physically received
 * stock — distinct from a profile preference and a confirmed order.
 */
@ApiTags(JERSEYS_API_TAG)
@Controller(INVENTORY_ROUTE)
export class JerseyInventoryController {
  constructor(
    private readonly query: JerseyQueryService,
    private readonly issueStock: IssueStockUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.JerseyRead)
  @ApiOperation({ summary: 'List jersey inventory' })
  @ApiOkResponse({ type: ListJerseyInventoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: JerseyPageQueryDto,
  ): Promise<ListJerseyInventoryResponseDto> {
    return this.query.listInventory(
      teamId,
      resolveJerseysPage(query.limit, query.offset),
    );
  }

  @Post(INVENTORY_ISSUE_ROUTE)
  @RequirePermissions(Permission.JerseyManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue or return jersey stock to a member' })
  @ApiOkResponse({ type: JerseyInventoryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  issue(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: IssueStockDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<JerseyInventoryResponseDto> {
    return this.issueStock.execute(actor, teamId, {
      content: toIssueContent(dto),
    });
  }
}
