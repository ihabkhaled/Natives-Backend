import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { NotFoundError } from '@core/errors/not-found.error';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import { Inject, Injectable } from '@nestjs/common';

import type { ArticleResponseDto } from '../api/dto/article-response.dto';
import type { ListArticlesResponseDto } from '../api/dto/list-articles.response.dto';
import { createArticle } from '../domain/article.entity';
import { isArticleOwnedBy } from '../domain/article-ownership.policy';
import { ArticleRepository } from '../infrastructure/article.repository';
import {
  toArticleResponse,
  toListArticlesResponse,
} from '../lib/article.mapper';
import {
  ARTICLE_NOT_FOUND_MESSAGE,
  ARTICLE_NOT_FOUND_MESSAGE_KEY,
} from '../model/article.constants';
import type {
  CreateArticleData,
  ListArticlesQuery,
} from '../model/article.types';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly articleRepository: ArticleRepository,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
  ) {}

  async create(
    data: CreateArticleData,
    ownerId: string,
  ): Promise<ArticleResponseDto> {
    const article = createArticle({
      data,
      id: this.idGenerator.generate(),
      ownerId,
      createdAt: this.clock.now(),
    });
    const saved = await this.articleRepository.save(article);
    return toArticleResponse(saved);
  }

  async getById(id: string, requesterId: string): Promise<ArticleResponseDto> {
    const article = await this.articleRepository.findByIdForOwner(
      id,
      requesterId,
    );
    if (article === null || !isArticleOwnedBy(article, requesterId)) {
      throw new NotFoundError(
        ARTICLE_NOT_FOUND_MESSAGE,
        ARTICLE_NOT_FOUND_MESSAGE_KEY,
      );
    }
    return toArticleResponse(article);
  }

  async list(
    query: ListArticlesQuery,
    requesterId: string,
  ): Promise<ListArticlesResponseDto> {
    const result = await this.articleRepository.listForOwner(
      query,
      requesterId,
    );
    return toListArticlesResponse(result);
  }
}
