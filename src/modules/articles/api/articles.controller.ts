import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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

import { ArticlesService } from '../application/articles.service';
import {
  ARTICLE_API_TAG,
  ARTICLE_ID_PARAM,
  ARTICLE_ID_ROUTE,
  ARTICLE_ROUTE,
} from '../model/article.constants';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles.query.dto';
import { ListArticlesResponseDto } from './dto/list-articles.response.dto';

@ApiTags(ARTICLE_API_TAG)
@Controller(ARTICLE_ROUTE)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @RequirePermissions(Permission.ArticleCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new article' })
  @ApiCreatedResponse({
    description: 'Article created',
    type: ArticleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.create(dto, user.userId);
  }

  @Get(ARTICLE_ID_ROUTE)
  @RequirePermissions(Permission.ArticleRead)
  @ApiOperation({ summary: 'Get an article by id' })
  @ApiOkResponse({ description: 'Article found', type: ArticleResponseDto })
  @ApiNotFoundResponse({ description: 'Article not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getById(
    @Param(ARTICLE_ID_PARAM, UuidValidationPipe) id: string,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.getById(id, user.userId);
  }

  @Get()
  @RequirePermissions(Permission.ArticleRead)
  @ApiOperation({ summary: 'List articles' })
  @ApiOkResponse({
    description: 'Articles list',
    type: ListArticlesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Query() query: ListArticlesQueryDto,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<ListArticlesResponseDto> {
    return this.articlesService.list(query, user.userId);
  }
}
