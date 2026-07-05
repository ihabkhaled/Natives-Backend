export enum ArticleStatus {
  Draft = 'draft',
  Published = 'published',
}

export const ARTICLE_STATUS_VALUES: readonly ArticleStatus[] =
  Object.values(ArticleStatus);
