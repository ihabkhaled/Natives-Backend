import type { ArticleStatus } from './article.enums';

export interface Article {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: ArticleStatus;
  readonly ownerId: string;
  readonly createdAt: string;
}

export interface CreateArticleData {
  readonly title: string;
  readonly body: string;
}

export interface CreateArticleInput {
  readonly data: CreateArticleData;
  readonly id: string;
  readonly ownerId: string;
  readonly createdAt: Date;
}

export interface ListArticlesQuery {
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListArticlesResult {
  readonly items: readonly Article[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
