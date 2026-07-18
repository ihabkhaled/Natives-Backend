import { describe, expect, it } from 'vitest';

import {
  toDate,
  toNullableDate,
  toPermissionScope,
  unionPermissions,
} from './rbac.helpers';

describe('toDate', () => {
  it('passes a Date through unchanged', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    expect(toDate(date)).toBe(date);
  });

  it('parses an ISO string', () => {
    expect(toDate('2026-01-01T00:00:00.000Z').toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});

describe('toNullableDate', () => {
  it('returns null for null', () => {
    expect(toNullableDate(null)).toBeNull();
  });

  it('passes a Date through', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    expect(toNullableDate(date)).toBe(date);
  });

  it('parses an ISO string', () => {
    expect(toNullableDate('2026-01-01T00:00:00.000Z')?.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});

describe('toPermissionScope', () => {
  it('omits both dimensions when null', () => {
    expect(toPermissionScope(null, null)).toEqual({});
  });

  it('includes the team when present', () => {
    expect(toPermissionScope('team-1', null)).toEqual({ teamId: 'team-1' });
  });

  it('includes both dimensions when present', () => {
    expect(toPermissionScope('team-1', 'season-1')).toEqual({
      teamId: 'team-1',
      seasonId: 'season-1',
    });
  });
});

describe('unionPermissions', () => {
  it('merges two sets and dedups', () => {
    const result = unionPermissions(new Set(['a', 'b']), new Set(['b', 'c']));

    expect([...result].sort()).toEqual(['a', 'b', 'c']);
  });
});
