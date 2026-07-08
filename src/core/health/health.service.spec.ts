import { describe, expect, it } from 'vitest';

import { HealthService } from './health.service';

const fixedDate = new Date('2024-01-01T00:00:00.000Z');
const clock = { now: () => fixedDate, uptime: () => 42 };

describe('HealthService', () => {
  it('reports an ok status with uptime and a timestamp from the clock port', () => {
    const result = new HealthService(clock).check();

    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBe(42);
    expect(result.timestamp).toBe(fixedDate.toISOString());
  });
});
