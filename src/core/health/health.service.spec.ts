import { describe, expect, it } from 'vitest';

import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports an ok status with uptime and a timestamp', () => {
    const result = new HealthService().check();

    expect(result.status).toBe('ok');
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });
});
