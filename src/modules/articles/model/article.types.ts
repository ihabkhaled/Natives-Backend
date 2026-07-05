import type { ArticleStatus } from './article.enums';

export interface Article {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: ArticleStatus;
  readonly createdAt: string;
}

export interface CreateArticleData {
  readonly title: string;
  readonly body: string;
  readonly status: ArticleStatus;
}

export interface ListArticlesQuery {
  readonly limit: number;
  readonly offset: number;
}
