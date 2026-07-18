import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentQueryService } from './assessment-query.service';

const SCOPE = {} as never;
const PAGE = { limit: 20, offset: 0 };

function build() {
  const catalog = {
    listCategories: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listScales: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listMetrics: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listTemplates: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listPeriods: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (scope: never) => Promise<unknown>) =>
      operation(SCOPE),
    ),
  };
  return {
    catalog,
    service: new AssessmentQueryService(unitOfWork as never, catalog as never),
  };
}

describe('AssessmentQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reads global categories inside a transaction', async () => {
    await harness.service.listCategories(PAGE);
    expect(harness.catalog.listCategories).toHaveBeenCalledWith(SCOPE, PAGE);
  });

  it('reads global scales inside a transaction', async () => {
    await harness.service.listScales(PAGE);
    expect(harness.catalog.listScales).toHaveBeenCalledWith(SCOPE, PAGE);
  });

  it('reads team-scoped metrics, templates, and periods', async () => {
    await harness.service.listMetrics('team-1', PAGE);
    await harness.service.listTemplates('team-1', PAGE);
    await harness.service.listPeriods('team-1', PAGE);
    expect(harness.catalog.listMetrics).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      PAGE,
    );
    expect(harness.catalog.listTemplates).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      PAGE,
    );
    expect(harness.catalog.listPeriods).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      PAGE,
    );
  });
});
