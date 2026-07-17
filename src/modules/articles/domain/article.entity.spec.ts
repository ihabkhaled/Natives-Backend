import { describe, expect, it } from 'vitest';

import { ArticleStatus } from '../model/article.enums';
import type { CreateArticleData } from '../model/article.types';
import { createArticle } from './article.entity';

const data: CreateArticleData = { title: 'Hello', body: 'World' };
const fixedDate = new Date('2024-01-01T00:00:00.000Z');

describe('createArticle', () => {
  it('creates an article from the provided id, owner, data, and timestamp', () => {
    const article = createArticle({
      data,
      id: '00000000-0000-4000-a000-000000000000',
      ownerId: 'user-1',
      createdAt: fixedDate,
    });

    expect(article.id).toBe('00000000-0000-4000-a000-000000000000');
    expect(article.title).toBe('Hello');
    expect(article.body).toBe('World');
    expect(article.status).toBe(ArticleStatus.Draft);
    expect(article.ownerId).toBe('user-1');
    expect(article.createdAt).toBe(fixedDate.toISOString());
  });
});
