import type { AppLogger } from '@core/logger';
import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { TypeormDatabaseReadinessAdapter } from './typeorm-database-readiness.adapter';

function createLoggerMock() {
  return {
    setContext: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('TypeormDatabaseReadinessAdapter', () => {
  it('reports reachable when the probe query succeeds', async () => {
    const logger = createLoggerMock();
    const dataSource = {
      isInitialized: true,
      query: vi.fn().mockResolvedValue([{ column: 1 }]),
      initialize: vi.fn(),
    } as unknown as DataSource;
    const adapter = new TypeormDatabaseReadinessAdapter(
      dataSource,
      logger as unknown as AppLogger,
    );

    expect(await adapter.check()).toEqual({ reachable: true });
  });

  it('initializes the data source before probing when needed', async () => {
    const logger = createLoggerMock();
    const initialize = vi.fn().mockResolvedValue(undefined);
    const dataSource = {
      isInitialized: false,
      query: vi.fn().mockResolvedValue([]),
      initialize,
    } as unknown as DataSource;
    const adapter = new TypeormDatabaseReadinessAdapter(
      dataSource,
      logger as unknown as AppLogger,
    );

    expect(await adapter.check()).toEqual({ reachable: true });
    expect(initialize).toHaveBeenCalledOnce();
  });

  it('reports unreachable and logs safely when the probe fails', async () => {
    const logger = createLoggerMock();
    const dataSource = {
      isInitialized: true,
      query: vi.fn().mockRejectedValue(new Error('connection refused')),
      initialize: vi.fn(),
    } as unknown as DataSource;
    const adapter = new TypeormDatabaseReadinessAdapter(
      dataSource,
      logger as unknown as AppLogger,
    );

    expect(await adapter.check()).toEqual({ reachable: false });
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
