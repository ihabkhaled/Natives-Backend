import type { ErrorMessageKey } from '@core/errors/error.types';

export const ARTICLE_ROUTE = 'articles';
export const ARTICLE_ID_ROUTE = ':id';
export const ARTICLE_ID_PARAM = 'id';
export const ARTICLE_API_TAG = 'articles';

export const ARTICLE_TITLE_MIN_LENGTH = 3;
export const ARTICLE_TITLE_MAX_LENGTH = 200;
export const ARTICLE_BODY_MAX_LENGTH = 10_000;

export const ARTICLE_LIST_MIN_LIMIT = 1;
export const ARTICLE_LIST_MAX_LIMIT = 100;
export const ARTICLE_LIST_DEFAULT_LIMIT = 20;
export const ARTICLE_LIST_DEFAULT_OFFSET = 0;

export const ARTICLE_NOT_FOUND_MESSAGE = 'Article not found';
export const ARTICLE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.article.notFound';
