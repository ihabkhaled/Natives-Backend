import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { jobsConfig } from './jobs.config';

const ORIGINAL_ENV = { ...process.env };

describe('jobsConfig', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['JOBS_ENABLED'];
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults the scheduler on outside test', () => {
    expect(jobsConfig()).toEqual({ enabled: true });
  });

  it('honours an explicit JOBS_ENABLED=false', () => {
    process.env['JOBS_ENABLED'] = 'false';

    expect(jobsConfig()).toEqual({ enabled: false });
  });

  it('forces the scheduler off under NODE_ENV=test even when flagged on', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['JOBS_ENABLED'] = 'true';

    expect(jobsConfig()).toEqual({ enabled: false });
  });

  it('rejects a malformed boolean flag', () => {
    process.env['JOBS_ENABLED'] = 'yes';

    expect(() => jobsConfig()).toThrow();
  });
});
