import { Injectable } from '@nestjs/common';

import { ARTICLE_LIST_MAX_LIMIT } from '../model/article.constants';
import type {
  Article,
  CreateArticleData,
  ListArticlesQuery,
} from '../model/article.types';

/**
 * In-memory persistence for the reference module — no ORM/database is forced on
 * the starter. Swap this class for a TypeORM/Prisma/Mongoose implementation
 * behind the same method contract; nothing above this layer changes. See rules/04.
 */
@Injectable()
export class ArticleRepository {
  private readonly store = new Map<string, Article>();

  create(
    id: string,
    data: CreateArticleData,
    createdAt: string,
  ): Promise<Article> {
    const article: Article = { id, ...data, createdAt };
    this.store.set(id, article);
    return Promise.resolve(article);
  }

  findById(id: string): Promise<Article | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  list(query: ListArticlesQuery): Promise<readonly Article[]> {
    const limit = Math.min(query.limit, ARTICLE_LIST_MAX_LIMIT);
    const page = [...this.store.values()].slice(
      query.offset,
      query.offset + limit,
    );
    return Promise.resolve(page);
  }
}
