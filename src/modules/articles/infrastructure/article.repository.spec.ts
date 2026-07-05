import { beforeEach, describe, expect, it } from 'vitest';

import { ArticleStatus } from '../model/article.enums';
import type { CreateArticleData } from '../model/article.types';
import { ArticleRepository } from './article.repository';

const data: CreateArticleData = {
  title: 'Hello',
  body: 'World',
  status: ArticleStatus.Draft,
};

describe('ArticleRepository', () => {
  let repository: ArticleRepository;

  beforeEach(() => {
    repository = new ArticleRepository();
  });

  it('creates and retrieves an article by id', async () => {
    const created = await repository.create(
      'a1',
      data,
      '2024-01-01T00:00:00.000Z',
    );

    expect(created.id).toBe('a1');
    expect(await repository.findById('a1')).toEqual(created);
  });

  it('returns null when an article is missing', async () => {
    expect(await repository.findById('missing')).toBeNull();
  });

  it('lists articles bounded by limit and offset', async () => {
    await repository.create('a1', data, 't1');
    await repository.create('a2', data, 't2');
    await repository.create('a3', data, 't3');

    const page = await repository.list({ limit: 2, offset: 1 });

    expect(page).toHaveLength(2);
  });

  it('clamps the limit to the hard maximum', async () => {
    await repository.create('a1', data, 't1');

    const page = await repository.list({ limit: 10_000, offset: 0 });

    expect(page).toHaveLength(1);
  });
});
