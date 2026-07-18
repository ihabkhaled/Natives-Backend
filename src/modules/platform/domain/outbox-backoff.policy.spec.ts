import { describe, expect, it } from 'vitest';

import {
  OUTBOX_BACKOFF_BASE_MS,
  OUTBOX_BACKOFF_CAP_MS,
  OUTBOX_MAX_ATTEMPTS,
} from '../model/platform.constants';
import { backoffDelayMs, planRetry } from './outbox-backoff.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');

describe('outbox-backoff.policy', () => {
  describe('backoffDelayMs', () => {
    it('grows exponentially from the base delay', () => {
      expect(backoffDelayMs(1)).toBe(OUTBOX_BACKOFF_BASE_MS);
      expect(backoffDelayMs(2)).toBe(OUTBOX_BACKOFF_BASE_MS * 2);
      expect(backoffDelayMs(3)).toBe(OUTBOX_BACKOFF_BASE_MS * 4);
    });

    it('clamps to the configured cap', () => {
      expect(backoffDelayMs(100)).toBe(OUTBOX_BACKOFF_CAP_MS);
    });

    it('treats attempt 0 as the base delay', () => {
      expect(backoffDelayMs(0)).toBe(OUTBOX_BACKOFF_BASE_MS);
    });
  });

  describe('planRetry', () => {
    it('reschedules with backoff below the attempt ceiling', () => {
      const plan = planRetry(2, NOW);
      expect(plan.deadLettered).toBe(false);
      expect(plan.availableAt.getTime()).toBe(
        NOW.getTime() + OUTBOX_BACKOFF_BASE_MS * 2,
      );
    });

    it('dead-letters at the attempt ceiling', () => {
      const plan = planRetry(OUTBOX_MAX_ATTEMPTS, NOW);
      expect(plan.deadLettered).toBe(true);
      expect(plan.availableAt).toEqual(NOW);
    });
  });
});
