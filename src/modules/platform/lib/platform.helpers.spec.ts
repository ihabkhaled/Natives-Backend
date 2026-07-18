import { describe, expect, it } from 'vitest';

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MAX_OFFSET,
} from '../model/platform.constants';
import {
  AuditOutcome,
  IdempotencyStatus,
  NotificationCategory,
  NotificationChannel,
  OutboxStatus,
} from '../model/platform.enums';
import {
  parseAuditOutcome,
  parseIdempotencyStatus,
  parseNotificationCategory,
  parseNotificationChannel,
  parseOutboxStatus,
  resolvePage,
  toDate,
  toNullableDate,
} from './platform.helpers';

const ISO = '2026-06-01T12:00:00.000Z';

describe('platform.helpers', () => {
  describe('toDate / toNullableDate', () => {
    it('passes a Date through and parses an ISO string', () => {
      const date = new Date(ISO);
      expect(toDate(date)).toBe(date);
      expect(toDate(ISO)).toEqual(date);
    });

    it('preserves null and parses non-null in toNullableDate', () => {
      expect(toNullableDate(null)).toBeNull();
      expect(toNullableDate(ISO)).toEqual(new Date(ISO));
      const date = new Date(ISO);
      expect(toNullableDate(date)).toBe(date);
    });
  });

  describe('resolvePage', () => {
    it('applies defaults when limit/offset are undefined', () => {
      expect(resolvePage(undefined, undefined)).toEqual({
        limit: LIST_DEFAULT_LIMIT,
        offset: 0,
      });
    });

    it('clamps the limit to the maximum and floors it at one', () => {
      expect(resolvePage(9999, 0).limit).toBe(LIST_MAX_LIMIT);
      expect(resolvePage(0, 0).limit).toBe(1);
    });

    it('clamps the offset to bounds', () => {
      expect(resolvePage(10, 9_999_999).offset).toBe(LIST_MAX_OFFSET);
      expect(resolvePage(10, -5).offset).toBe(0);
    });
  });

  describe('enum parsers', () => {
    it('parse valid values', () => {
      expect(parseAuditOutcome('success')).toBe(AuditOutcome.Success);
      expect(parseOutboxStatus('pending')).toBe(OutboxStatus.Pending);
      expect(parseIdempotencyStatus('completed')).toBe(
        IdempotencyStatus.Completed,
      );
      expect(parseNotificationCategory('practice')).toBe(
        NotificationCategory.Practice,
      );
      expect(parseNotificationChannel('in_app')).toBe(
        NotificationChannel.InApp,
      );
    });

    it('throws on an unrecognized value', () => {
      expect(() => parseOutboxStatus('bogus')).toThrow(/outbox status/u);
      expect(() => parseAuditOutcome('nope')).toThrow(/audit outcome/u);
      expect(() => parseIdempotencyStatus('x')).toThrow(/idempotency status/u);
      expect(() => parseNotificationCategory('x')).toThrow(/category/u);
      expect(() => parseNotificationChannel('x')).toThrow(/channel/u);
    });
  });
});
