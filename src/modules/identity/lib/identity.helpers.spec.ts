import { Role } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { InvitationStatus, UserStatus } from '../model/identity.enums';
import {
  firstRow,
  normalizeEmail,
  parseInvitationStatus,
  parseRole,
  parseUserStatus,
  toDate,
  toNullableDate,
} from './identity.helpers';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lower-cases', () => {
    expect(normalizeEmail('  Coach@Example.TEST  ')).toBe('coach@example.test');
  });

  it('leaves an already-canonical email unchanged', () => {
    expect(normalizeEmail('coach@example.test')).toBe('coach@example.test');
  });
});

describe('parseRole', () => {
  it('maps a known role string to the enum', () => {
    expect(parseRole('admin')).toBe(Role.Admin);
    expect(parseRole('user')).toBe(Role.User);
  });

  it('defaults to the least-privileged role for an unknown value', () => {
    expect(parseRole('superuser')).toBe(Role.User);
  });
});

describe('parseUserStatus', () => {
  it('maps a known status string to the enum', () => {
    expect(parseUserStatus('active')).toBe(UserStatus.Active);
    expect(parseUserStatus('suspended')).toBe(UserStatus.Suspended);
  });

  it('defaults to Inactive for an unknown value', () => {
    expect(parseUserStatus('mystery')).toBe(UserStatus.Inactive);
  });
});

describe('parseInvitationStatus', () => {
  it('maps a known status string to the enum', () => {
    expect(parseInvitationStatus('pending')).toBe(InvitationStatus.Pending);
    expect(parseInvitationStatus('accepted')).toBe(InvitationStatus.Accepted);
  });

  it('defaults to Expired for an unknown value', () => {
    expect(parseInvitationStatus('nonsense')).toBe(InvitationStatus.Expired);
  });
});

describe('toNullableDate', () => {
  it('returns null for a null value', () => {
    expect(toNullableDate(null)).toBeNull();
  });

  it('returns the same Date instance when given a Date', () => {
    const date = new Date('2026-06-01T12:00:00.000Z');
    expect(toNullableDate(date)).toBe(date);
  });

  it('parses an ISO string into a Date', () => {
    const result = toNullableDate('2026-06-01T12:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-06-01T12:00:00.000Z');
  });
});

describe('toDate', () => {
  it('returns the same Date instance when given a Date', () => {
    const date = new Date('2026-06-01T12:00:00.000Z');
    expect(toDate(date)).toBe(date);
  });

  it('parses an ISO string into a Date', () => {
    const result = toDate('2026-06-01T12:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-06-01T12:00:00.000Z');
  });
});

describe('firstRow', () => {
  it('returns the first element of a non-empty array', () => {
    expect(firstRow([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
  });

  it('throws when the array is empty', () => {
    expect(() => firstRow([])).toThrow(
      'Expected at least one row from a returning statement',
    );
  });
});
