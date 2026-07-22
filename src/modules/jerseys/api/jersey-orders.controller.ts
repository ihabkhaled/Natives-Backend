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

import { JerseyQueryService } from '../application/jersey-query.service';
import { ManageOrderUseCase } from '../application/manage-order.use-case';
import { SupplierExportService } from '../application/supplier-export.service';
import { resolveJerseysPage } from '../lib/jerseys.helpers';
import {
  toOrderContent,
  toOrderItemContent,
  toOrderListFilter,
} from '../lib/jerseys-command.mapper';
import {
  JERSEYS_API_TAG,
  ORDER_ID_PARAM,
  ORDER_ITEM_ROUTE,
  ORDER_ITEMS_ROUTE,
  ORDER_SUPPLIER_EXPORT_ROUTE,
  ORDER_TRANSITION_ROUTE,
  ORDERS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/jerseys.constants';
import {
  AddOrderItemDto,
  CreateJerseyOrderDto,
  JerseyOrderItemResponseDto,
  JerseyOrderResponseDto,
  ListJerseyOrderItemsResponseDto,
  ListJerseyOrdersResponseDto,
  OrderListQueryDto,
  SupplierExportResponseDto,
  TransitionJerseyOrderDto,
} from './dto/jerseys.dto';

/**
 * HTTP surface for apparel orders (jersey.read / jersey.manage). Items may only
 * be added while the order is a draft; the supplier export is privacy-minimal.
 */
@ApiTags(JERSEYS_API_TAG)
@Controller(ORDERS_ROUTE)
export class JerseyOrdersController {
  constructor(
    private readonly query: JerseyQueryService,
    private readonly orders: ManageOrderUseCase,
    private readonly supplierExport: SupplierExportService,
  ) {}

  @Get()
  @RequirePermissions(Permission.JerseyRead)
  @ApiOperation({ summary: 'List apparel orders' })
  @ApiOkResponse({ type: ListJerseyOrdersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: OrderListQueryDto,
  ): Promise<ListJerseyOrdersResponseDto> {
    return this.query.listOrders(
      teamId,
      toOrderListFilter(query),
      resolveJerseysPage(query.limit, query.offset),
    );
  }

  @Get(ORDER_ITEM_ROUTE)
  @RequirePermissions(Permission.JerseyRead)
  @ApiOperation({ summary: 'Get one order' })
  @ApiOkResponse({ type: JerseyOrderResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ORDER_ID_PARAM, UuidValidationPipe) orderId: string,
  ): Promise<JerseyOrderResponseDto> {
    return this.query.getOrder(teamId, orderId);
  }

  @Get(ORDER_ITEMS_ROUTE)
  @RequirePermissions(Permission.JerseyRead)
  @ApiOperation({ summary: 'List an order’s line items' })
  @ApiOkResponse({ type: ListJerseyOrderItemsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  items(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ORDER_ID_PARAM, UuidValidationPipe) orderId: string,
  ): Promise<ListJerseyOrderItemsResponseDto> {
    return this.query.listOrderItems(teamId, orderId);
  }

  @Get(ORDER_SUPPLIER_EXPORT_ROUTE)
  @RequirePermissions(Permission.JerseyManage)
  @ApiOperation({ summary: 'Privacy-minimal supplier export for an order' })
  @ApiOkResponse({ type: SupplierExportResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  export(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ORDER_ID_PARAM, UuidValidationPipe) orderId: string,
  ): Promise<SupplierExportResponseDto> {
    return this.supplierExport.forOrder(teamId, orderId);
  }

  @Post()
  @RequirePermissions(Permission.JerseyManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft apparel order' })
  @ApiCreatedResponse({ type: JerseyOrderResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateJerseyOrderDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<JerseyOrderResponseDto> {
    return this.orders.create(actor, teamId, {
      content: toOrderContent(dto),
    });
  }

  @Post(ORDER_ITEMS_ROUTE)
  @RequirePermissions(Permission.JerseyManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a validated item to a draft order' })
  @ApiCreatedResponse({ type: JerseyOrderItemResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  addItem(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ORDER_ID_PARAM, UuidValidationPipe) orderId: string,
    @Body() dto: AddOrderItemDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<JerseyOrderItemResponseDto> {
    return this.orders.addItem(actor, teamId, orderId, {
      content: toOrderItemContent(dto),
    });
  }

  @Post(ORDER_TRANSITION_ROUTE)
  @RequirePermissions(Permission.JerseyManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance an order through its lifecycle' })
  @ApiOkResponse({ type: JerseyOrderResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ORDER_ID_PARAM, UuidValidationPipe) orderId: string,
    @Body() dto: TransitionJerseyOrderDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<JerseyOrderResponseDto> {
    return this.orders.transition(actor, teamId, orderId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
