import { describe, expect, it } from 'vitest';

import { ArticleStatus } from '../model/article.enums';
import type { Article } from '../model/article.types';
import { isArticleOwnedBy } from './article-ownership.policy';

const article: Article = {
  id: 'a1',
  title: 'Title',
  body: 'Body',
  status: ArticleStatus.Draft,
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('isArticleOwnedBy', () => {
  it('returns true for the owner', () => {
    expect(isArticleOwnedBy(article, 'user-1')).toBe(true);
  });

  it('returns false for another requester', () => {
    expect(isArticleOwnedBy(article, 'user-2')).toBe(false);
  });
});
