import { describe, expect, it, vi } from 'vitest';

import {
  INVITATION_EXPIRY_INTERVAL_MS,
  INVITATION_EXPIRY_JOB_KEY,
} from '../model/identity.constants';
import { InvitationExpiryJob } from './invitation-expiry.job';

function build() {
  const registry = { register: vi.fn(), list: vi.fn() };
  const useCase = { execute: vi.fn().mockResolvedValue(3) };
  const job = new InvitationExpiryJob(registry, useCase as never);
  return { job, registry, useCase };
}

describe('InvitationExpiryJob', () => {
  it('declares the expiry key and hourly interval', () => {
    const { job } = build();

    expect(job.jobKey).toBe(INVITATION_EXPIRY_JOB_KEY);
    expect(job.intervalMs).toBe(INVITATION_EXPIRY_INTERVAL_MS);
  });

  it('registers itself with the platform job seam on module init', () => {
    const { job, registry } = build();

    job.onModuleInit();

    expect(registry.register).toHaveBeenCalledWith(job);
  });

  it('sweeps overdue invitations per run', async () => {
    const { job, useCase } = build();

    await job.run();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });
});
