import { beforeEach, describe, expect, it } from 'vitest';

import { ArticleStatus } from '../model/article.enums';
import type { Article } from '../model/article.types';
import { ArticleRepository } from './article.repository';

const article: Article = {
  id: 'a1',
  title: 'Hello',
  body: 'World',
  status: ArticleStatus.Draft,
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('ArticleRepository', () => {
  let repository: ArticleRepository;

  beforeEach(() => {
    repository = new ArticleRepository();
  });

  it('saves and retrieves an article by id', async () => {
    const saved = await repository.save(article);

    expect(saved.id).toBe('a1');
    expect(await repository.findByIdForOwner('a1', 'user-1')).toEqual(saved);
  });

  it('returns null when an article is missing or belongs to another owner', async () => {
    await repository.save(article);

    expect(await repository.findByIdForOwner('missing', 'user-1')).toBeNull();
    expect(await repository.findByIdForOwner('a1', 'user-2')).toBeNull();
  });

  it('returns a paginated envelope with items, total, limit, and offset', async () => {
    await repository.save({ ...article, id: 'a1' });
    await repository.save({ ...article, id: 'a2' });
    await repository.save({ ...article, id: 'a3' });

    const page = await repository.listForOwner(
      { limit: 2, offset: 1 },
      'user-1',
    );

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.limit).toBe(2);
    expect(page.offset).toBe(1);
  });

  it('clamps the limit to the hard maximum', async () => {
    await repository.save({ ...article, id: 'a1' });

    const page = await repository.listForOwner(
      { limit: 10_000, offset: 0 },
      'user-1',
    );

    expect(page.items).toHaveLength(1);
    expect(page.limit).toBe(100);
  });

  it('applies defaults when limit and offset are omitted', async () => {
    await repository.save({ ...article, id: 'a1' });

    const page = await repository.listForOwner({}, 'user-1');

    expect(page.items).toHaveLength(1);
    expect(page.limit).toBe(20);
    expect(page.offset).toBe(0);
  });

  it('orders articles by createdAt ascending', async () => {
    await repository.save({
      ...article,
      id: 'a2',
      createdAt: '2024-01-02T00:00:00.000Z',
    });
    await repository.save({
      ...article,
      id: 'a1',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    const page = await repository.listForOwner(
      { limit: 10, offset: 0 },
      'user-1',
    );

    expect(page.items[0].id).toBe('a1');
    expect(page.items[1].id).toBe('a2');
  });

  it('scopes items and total before applying pagination', async () => {
    await repository.save(article);
    await repository.save({ ...article, id: 'a2', ownerId: 'user-2' });

    const page = await repository.listForOwner(
      { limit: 1, offset: 0 },
      'user-1',
    );

    expect(page.items).toEqual([article]);
    expect(page.total).toBe(1);
  });
});
