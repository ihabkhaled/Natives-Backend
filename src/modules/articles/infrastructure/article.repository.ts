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

  findByIdForOwner(id: string, ownerId: string): Promise<Article | null> {
    const article = this.store.get(id);
    if (article?.ownerId !== ownerId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(article);
  }

  listForOwner(
    query: ListArticlesQuery,
    ownerId: string,
  ): Promise<ListArticlesResult> {
    const limit = Math.min(
      query.limit ?? ARTICLE_LIST_DEFAULT_LIMIT,
      ARTICLE_LIST_MAX_LIMIT,
    );
    const offset = query.offset ?? ARTICLE_LIST_DEFAULT_OFFSET;
    const ownedArticles = [...this.store.values()]
      .filter(article => article.ownerId === ownerId)
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
    const items = ownedArticles.slice(offset, offset + limit);

    return Promise.resolve({
      items,
      total: ownedArticles.length,
      limit,
      offset,
    });
  }
}
