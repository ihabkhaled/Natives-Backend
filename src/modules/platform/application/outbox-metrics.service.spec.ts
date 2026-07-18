import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OutboxMetricsService } from './outbox-metrics.service';

const SCOPE = {} as never;

function build() {
  const outbox = {
    metrics: vi.fn().mockResolvedValue([
      { status: 'pending', count: 2 },
      { status: 'completed', count: 7 },
    ]),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const service = new OutboxMetricsService(
    unitOfWork as never,
    outbox as never,
  );
  return { service };
}

describe('OutboxMetricsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('folds status counts into dense metrics', async () => {
    expect(await harness.service.read()).toEqual({
      pending: 2,
      processing: 0,
      completed: 7,
      deadLettered: 0,
    });
  });
});
