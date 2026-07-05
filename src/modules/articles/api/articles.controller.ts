import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ArticlesService } from '../application/articles.service';
import type { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles.query.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@Body() dto: CreateArticleDto): Promise<ArticleResponseDto> {
    return this.articlesService.create(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<ArticleResponseDto> {
    return this.articlesService.getById(id);
  }

  @Get()
  list(
    @Query() query: ListArticlesQueryDto,
  ): Promise<readonly ArticleResponseDto[]> {
    return this.articlesService.list(query);
  }
}
