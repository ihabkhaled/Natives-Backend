import { describe, expect, it, vi } from 'vitest';

import { CatalogName } from '../model/teams.enums';
import { CatalogQueryService } from './catalog-query.service';

const SCOPE = {} as never;

describe('CatalogQueryService', () => {
  it('lists catalog entries through the repository', async () => {
    const unitOfWork = {
      runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
    };
    const catalog = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new CatalogQueryService(
      unitOfWork as never,
      catalog as never,
    );
    const page = { limit: 20, offset: 0 };

    await service.listEntries('team-1', CatalogName.Division, page);

    expect(catalog.list).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      CatalogName.Division,
      page,
    );
  });
});
