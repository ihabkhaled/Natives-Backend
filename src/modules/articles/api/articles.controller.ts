import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { type AuthUserIdentity, CurrentUser } from '../../auth';
import { ArticlesService } from '../application/articles.service';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles.query.dto';
import { ListArticlesResponseDto } from './dto/list-articles.response.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
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

  @Get(':id')
  @ApiOperation({ summary: 'Get an article by id' })
  @ApiOkResponse({ description: 'Article found', type: ArticleResponseDto })
  @ApiNotFoundResponse({ description: 'Article not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.getById(id, user.userId);
  }

  @Get()
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
