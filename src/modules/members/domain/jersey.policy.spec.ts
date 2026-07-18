import { describe, expect, it } from 'vitest';

import type { JerseyReservation } from '../model/members.types';
import { findJerseyConflict } from './jersey.policy';

const RESERVATIONS: readonly JerseyReservation[] = [
  { membershipId: 'mem-1', jerseyNumber: 7 },
  { membershipId: 'mem-2', jerseyNumber: 0 },
];

describe('jersey.policy', () => {
  describe('findJerseyConflict', () => {
    it('finds a conflict held by another member', () => {
      expect(findJerseyConflict(RESERVATIONS, 7, 'mem-9')).toEqual({
        membershipId: 'mem-1',
        jerseyNumber: 7,
      });
    });

    it('treats zero as a real jersey number', () => {
      expect(findJerseyConflict(RESERVATIONS, 0, 'mem-9')).toEqual({
        membershipId: 'mem-2',
        jerseyNumber: 0,
      });
    });

    it('excludes the member being edited (no self-collision)', () => {
      expect(findJerseyConflict(RESERVATIONS, 7, 'mem-1')).toBeNull();
    });

    it('returns null when the number is free', () => {
      expect(findJerseyConflict(RESERVATIONS, 99, 'mem-9')).toBeNull();
    });
  });
});
