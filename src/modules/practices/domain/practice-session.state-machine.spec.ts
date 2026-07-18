import { describe, expect, it } from 'vitest';

import { SessionStatus } from '../model/practices.enums';
import {
  allowedTransitions,
  canReschedule,
  canTransition,
  isTerminal,
} from './practice-session.state-machine';

describe('practice-session state machine', () => {
  describe('allowedTransitions', () => {
    it('lists targets for a draft session', () => {
      expect(allowedTransitions(SessionStatus.Draft)).toEqual([
        SessionStatus.Published,
        SessionStatus.Cancelled,
        SessionStatus.Archived,
      ]);
    });

    it('returns an empty set for the terminal archived state', () => {
      expect(allowedTransitions(SessionStatus.Archived)).toEqual([]);
    });
  });

  describe('canTransition', () => {
    it('permits draft -> published', () => {
      expect(canTransition(SessionStatus.Draft, SessionStatus.Published)).toBe(
        true,
      );
    });

    it('permits cancelled -> published (re-open)', () => {
      expect(
        canTransition(SessionStatus.Cancelled, SessionStatus.Published),
      ).toBe(true);
    });

    it('permits published -> completed', () => {
      expect(
        canTransition(SessionStatus.Published, SessionStatus.Completed),
      ).toBe(true);
    });

    it('forbids a no-op self transition', () => {
      expect(
        canTransition(SessionStatus.Published, SessionStatus.Published),
      ).toBe(false);
    });

    it('forbids completed -> published', () => {
      expect(
        canTransition(SessionStatus.Completed, SessionStatus.Published),
      ).toBe(false);
    });

    it('forbids any transition out of archived', () => {
      expect(
        canTransition(SessionStatus.Archived, SessionStatus.Published),
      ).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('is true only for archived', () => {
      expect(isTerminal(SessionStatus.Archived)).toBe(true);
      expect(isTerminal(SessionStatus.Cancelled)).toBe(false);
      expect(isTerminal(SessionStatus.Completed)).toBe(false);
    });
  });

  describe('canReschedule', () => {
    it('allows a published or rescheduled session to move', () => {
      expect(canReschedule(SessionStatus.Published)).toBe(true);
      expect(canReschedule(SessionStatus.Rescheduled)).toBe(true);
    });

    it('rejects moving a draft, cancelled, completed, or archived session', () => {
      expect(canReschedule(SessionStatus.Draft)).toBe(false);
      expect(canReschedule(SessionStatus.Cancelled)).toBe(false);
      expect(canReschedule(SessionStatus.Completed)).toBe(false);
      expect(canReschedule(SessionStatus.Archived)).toBe(false);
    });
  });
});
