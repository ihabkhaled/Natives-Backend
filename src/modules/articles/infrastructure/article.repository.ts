import { Injectable } from '@nestjs/common';

import {
  ARTICLE_LIST_DEFAULT_LIMIT,
  ARTICLE_LIST_DEFAULT_OFFSET,
  ARTICLE_LIST_MAX_LIMIT,
} from '../model/article.constants';
import type {
  Article,
  ListArticlesQuery,
  ListArticlesResult,
} from '../model/article.types';

/**
 * In-memory persistence for the reference module — no ORM/database is forced on
 * the starter. Swap this class for a TypeORM/Prisma/Mongoose implementation
 * behind the same method contract; nothing above this layer changes. See rules/04.
 */
@Injectable()
export class ArticleRepository {
  private readonly store = new Map<string, Article>();

  save(article: Article): Promise<Article> {
    this.store.set(article.id, article);
    return Promise.resolve(article);
  }

  findById(id: string): Promise<Article | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  list(query: ListArticlesQuery): Promise<ListArticlesResult> {
    const limit = Math.min(
      query.limit ?? ARTICLE_LIST_DEFAULT_LIMIT,
      ARTICLE_LIST_MAX_LIMIT,
    );
    const offset = query.offset ?? ARTICLE_LIST_DEFAULT_OFFSET;
    const all = [...this.store.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const items = all.slice(offset, offset + limit);

    return Promise.resolve({
      items,
      total: all.length,
      limit,
      offset,
    });
  }
}
