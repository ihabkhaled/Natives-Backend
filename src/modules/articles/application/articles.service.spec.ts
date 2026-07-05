import { NotFoundError } from '@core/errors/not-found.error';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticleRepository } from '../infrastructure/article.repository';
import { ArticleStatus } from '../model/article.enums';
import type { Article } from '../model/article.types';
import { ArticlesService } from './articles.service';

const article: Article = {
  id: 'a1',
  title: 'Hello',
  body: 'World',
  status: ArticleStatus.Draft,
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('ArticlesService', () => {
  const repository = { create: vi.fn(), findById: vi.fn(), list: vi.fn() };
  let service: ArticlesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: ArticleRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ArticlesService);
  });

  it('creates a draft article and returns the mapped response', async () => {
    repository.create.mockResolvedValue(article);

    const result = await service.create({ title: 'Hello', body: 'World' });

    expect(repository.create).toHaveBeenCalled();
    expect(result).toEqual(article);
  });

  it('returns a mapped article when it exists', async () => {
    repository.findById.mockResolvedValue(article);

    const result = await service.getById('a1');

    expect(result.id).toBe('a1');
  });

  it('throws NotFoundError when the article is missing', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('applies default pagination when the query omits limit/offset', async () => {
    repository.list.mockResolvedValue([article]);

    await service.list({});

    expect(repository.list).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it('passes through explicit pagination', async () => {
    repository.list.mockResolvedValue([]);

    await service.list({ limit: 5, offset: 10 });

    expect(repository.list).toHaveBeenCalledWith({ limit: 5, offset: 10 });
  });
});
