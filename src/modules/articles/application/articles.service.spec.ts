import { CLOCK_PORT } from '@core/clock/clock.port';
import { ForbiddenError } from '@core/errors/forbidden.error';
import { NotFoundError } from '@core/errors/not-found.error';
import { ID_GENERATOR_PORT } from '@core/id-generator/id-generator.port';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticleRepository } from '../infrastructure/article.repository';
import { ArticleStatus } from '../model/article.enums';
import type { Article, CreateArticleData } from '../model/article.types';
import { ArticlesService } from './articles.service';

const article: Article = {
  id: 'a1',
  title: 'Hello',
  body: 'World',
  status: ArticleStatus.Draft,
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const data: CreateArticleData = { title: 'Hello', body: 'World' };
const fixedDate = new Date('2024-01-01T00:00:00.000Z');
const requesterId = 'user-1';

describe('ArticlesService', () => {
  const repository = { save: vi.fn(), findById: vi.fn(), list: vi.fn() };
  const clock = { now: vi.fn(), uptime: vi.fn() };
  const idGenerator = { generate: vi.fn() };
  let service: ArticlesService;

  beforeEach(async () => {
    clock.now.mockReturnValue(fixedDate);
    idGenerator.generate.mockReturnValue('a1');

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: ArticleRepository, useValue: repository },
        { provide: CLOCK_PORT, useValue: clock },
        { provide: ID_GENERATOR_PORT, useValue: idGenerator },
      ],
    }).compile();
    service = moduleRef.get(ArticlesService);
  });

  it('creates a draft article and returns the mapped response', async () => {
    repository.save.mockResolvedValue(article);

    const result = await service.create(data, requesterId);

    expect(idGenerator.generate).toHaveBeenCalled();
    expect(clock.now).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        title: 'Hello',
        body: 'World',
        status: ArticleStatus.Draft,
        ownerId: requesterId,
        createdAt: fixedDate.toISOString(),
      }),
    );
    expect(result).toEqual(article);
  });

  it('returns a mapped article when it exists and belongs to the requester', async () => {
    repository.findById.mockResolvedValue(article);

    const result = await service.getById('a1', requesterId);

    expect(result.id).toBe('a1');
  });

  it('throws NotFoundError when the article is missing', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.getById('missing', requesterId),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ForbiddenError when the article belongs to another user', async () => {
    repository.findById.mockResolvedValue({
      ...article,
      ownerId: 'user-2',
    });

    await expect(service.getById('a1', requesterId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('returns a paginated response envelope scoped to the requester', async () => {
    repository.list.mockResolvedValue({
      items: [article, { ...article, id: 'a2', ownerId: 'user-2' }],
      total: 2,
      limit: 20,
      offset: 0,
    });

    const result = await service.list({}, requesterId);

    expect(repository.list).toHaveBeenCalledWith({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('a1');
  });

  it('passes through explicit pagination', async () => {
    repository.list.mockResolvedValue({
      items: [],
      total: 0,
      limit: 5,
      offset: 10,
    });

    await service.list({ limit: 5, offset: 10 }, requesterId);

    expect(repository.list).toHaveBeenCalledWith({ limit: 5, offset: 10 });
  });
});
