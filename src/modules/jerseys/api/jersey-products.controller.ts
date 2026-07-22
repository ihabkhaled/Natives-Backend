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

import { CreateProductUseCase } from '../application/create-product.use-case';
import { JerseyQueryService } from '../application/jersey-query.service';
import { resolveJerseysPage } from '../lib/jerseys.helpers';
import { toProductContent } from '../lib/jerseys-command.mapper';
import {
  JERSEYS_API_TAG,
  PRODUCTS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/jerseys.constants';
import {
  CreateJerseyProductDto,
  JerseyPageQueryDto,
  JerseyProductResponseDto,
  ListJerseyProductsResponseDto,
} from './dto/jerseys.dto';

/**
 * HTTP surface for the jersey product catalogue (jersey.read / jersey.manage).
 */
@ApiTags(JERSEYS_API_TAG)
@Controller(PRODUCTS_ROUTE)
export class JerseyProductsController {
  constructor(
    private readonly query: JerseyQueryService,
    private readonly createProduct: CreateProductUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.JerseyRead)
  @ApiOperation({ summary: 'List a team’s jersey products' })
  @ApiOkResponse({ type: ListJerseyProductsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: JerseyPageQueryDto,
  ): Promise<ListJerseyProductsResponseDto> {
    return this.query.listProducts(
      teamId,
      resolveJerseysPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.JerseyManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a jersey product' })
  @ApiCreatedResponse({ type: JerseyProductResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateJerseyProductDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<JerseyProductResponseDto> {
    return this.createProduct.execute(actor, teamId, {
      content: toProductContent(dto),
    });
  }
}
