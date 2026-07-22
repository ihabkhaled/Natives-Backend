import { describe, expect, it, vi } from 'vitest';

import type { ScheduledJob } from '../model/platform.types';
import { JobRegistryService } from './job-registry.service';

function job(jobKey: string): ScheduledJob {
  return { jobKey, intervalMs: 1000, run: vi.fn() };
}

describe('JobRegistryService', () => {
  it('lists registered jobs ordered by key', () => {
    const registry = new JobRegistryService();
    registry.register(job('outbox.dispatcher'));
    registry.register(job('invitations.expiry'));

    expect(registry.list().map(entry => entry.jobKey)).toEqual([
      'invitations.expiry',
      'outbox.dispatcher',
    ]);
  });

  it('rejects a duplicate job key fail-fast', () => {
    const registry = new JobRegistryService();
    registry.register(job('outbox.dispatcher'));

    expect(() => registry.register(job('outbox.dispatcher'))).toThrow(
      'Duplicate scheduled job key',
    );
  });

  it('starts empty', () => {
    expect(new JobRegistryService().list()).toEqual([]);
  });
});
