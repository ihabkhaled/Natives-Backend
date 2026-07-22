import { describe, expect, it } from 'vitest';

import { LastSuperAdminError } from '../errors/last-super-admin.error';
import { assertNotLastSuperAdmin } from './super-admin-guard.policy';

describe('assertNotLastSuperAdmin', () => {
  it('denies the revoke when nobody would remain (count 0)', () => {
    expect(() => assertNotLastSuperAdmin(0)).toThrow(LastSuperAdminError);
  });

  it('denies removing the last super administrator (count 1)', () => {
    expect(() => assertNotLastSuperAdmin(1)).toThrow(LastSuperAdminError);
  });

  it('allows the revoke while another super administrator remains (count 2)', () => {
    expect(() => assertNotLastSuperAdmin(2)).not.toThrow();
  });

  it('allows the revoke for any larger count', () => {
    expect(() => assertNotLastSuperAdmin(5)).not.toThrow();
  });
});
