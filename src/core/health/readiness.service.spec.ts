import { ServiceUnavailableError } from '@core/errors/service-unavailable.error';
import type { DatabaseReadinessPort } from '@core/persistence/database-readiness.port';
import { describe, expect, it, vi } from 'vitest';

import { ReadinessService } from './readiness.service';

const fixedDate = new Date('2024-01-01T00:00:00.000Z');
const clock = { now: () => fixedDate, uptime: () => 0 };

describe('ReadinessService', () => {
  it('reports ready with the database up when the probe succeeds', async () => {
    const databaseReadiness = {
      check: vi.fn().mockResolvedValue({ reachable: true }),
    } as unknown as DatabaseReadinessPort;
    const service = new ReadinessService(clock, databaseReadiness);

    const status = await service.check();

    expect(status.status).toBe('ready');
    expect(status.database).toBe('up');
    expect(status.timestamp).toBe(fixedDate.toISOString());
  });

  it('raises a safe 503 error when the database is unreachable', async () => {
    const databaseReadiness = {
      check: vi.fn().mockResolvedValue({ reachable: false }),
    } as unknown as DatabaseReadinessPort;
    const service = new ReadinessService(clock, databaseReadiness);

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });
});
