import { randomUUID } from 'node:crypto';

import { NotFoundError } from '@core/errors/not-found.error';
import { Injectable } from '@nestjs/common';

import type { ArticleResponseDto } from '../api/dto/article-response.dto';
import type { CreateArticleDto } from '../api/dto/create-article.dto';
import type { ListArticlesQueryDto } from '../api/dto/list-articles.query.dto';
import { ArticleRepository } from '../infrastructure/article.repository';
import { toArticleResponse } from '../lib/article.mapper';
import {
  ARTICLE_LIST_DEFAULT_LIMIT,
  ARTICLE_NOT_FOUND_MESSAGE,
  ARTICLE_NOT_FOUND_MESSAGE_KEY,
} from '../model/article.constants';
import { ArticleStatus } from '../model/article.enums';

@Injectable()
export class ArticlesService {
  constructor(private readonly articleRepository: ArticleRepository) {}

  async create(dto: CreateArticleDto): Promise<ArticleResponseDto> {
    const created = await this.articleRepository.create(
      randomUUID(),
      { title: dto.title, body: dto.body, status: ArticleStatus.Draft },
      new Date().toISOString(),
    );
    return toArticleResponse(created);
  }

  async getById(id: string): Promise<ArticleResponseDto> {
    const article = await this.articleRepository.findById(id);
    if (article === null) {
      throw new NotFoundError(
        ARTICLE_NOT_FOUND_MESSAGE,
        ARTICLE_NOT_FOUND_MESSAGE_KEY,
      );
    }
    return toArticleResponse(article);
  }

  async list(
    query: ListArticlesQueryDto,
  ): Promise<readonly ArticleResponseDto[]> {
    const articles = await this.articleRepository.list({
      limit: query.limit ?? ARTICLE_LIST_DEFAULT_LIMIT,
      offset: query.offset ?? 0,
    });
    return articles.map(article => toArticleResponse(article));
  }
}
