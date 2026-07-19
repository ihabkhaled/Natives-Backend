import { describe, expect, it } from 'vitest';

import { SessionStatus, SessionTransition } from '../model/measurements.enums';
import {
  acceptsAttempts,
  nextSessionStatus,
} from './measurement-session.state-machine';

describe('nextSessionStatus', () => {
  it('conducts or cancels a scheduled session', () => {
    expect(
      nextSessionStatus(SessionStatus.Scheduled, SessionTransition.Conduct),
    ).toBe(SessionStatus.Conducted);
    expect(
      nextSessionStatus(SessionStatus.Scheduled, SessionTransition.Cancel),
    ).toBe(SessionStatus.Cancelled);
  });

  it('rejects any transition from a terminal state', () => {
    expect(
      nextSessionStatus(SessionStatus.Conducted, SessionTransition.Cancel),
    ).toBeNull();
    expect(
      nextSessionStatus(SessionStatus.Cancelled, SessionTransition.Conduct),
    ).toBeNull();
  });
});

describe('acceptsAttempts', () => {
  it('accepts attempts only for scheduled or conducted sessions', () => {
    expect(acceptsAttempts(SessionStatus.Scheduled)).toBe(true);
    expect(acceptsAttempts(SessionStatus.Conducted)).toBe(true);
    expect(acceptsAttempts(SessionStatus.Cancelled)).toBe(false);
  });
});
