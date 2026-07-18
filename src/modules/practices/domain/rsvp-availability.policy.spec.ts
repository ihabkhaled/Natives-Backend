import { describe, expect, it } from 'vitest';

import { RsvpStatus } from '../model/rsvp.enums';
import type { RsvpSlotState } from '../model/rsvp.types';
import {
  freedConfirmedSlot,
  hasFreeSpot,
  isConfirmedGoing,
  resolveWaitlisted,
} from './rsvp-availability.policy';

function slot(status: RsvpStatus, waitlisted: boolean): RsvpSlotState {
  return { status, waitlisted };
}

describe('resolveWaitlisted', () => {
  it('never waitlists an uncapped session', () => {
    expect(resolveWaitlisted(null, RsvpStatus.Going, 999)).toBe(false);
  });

  it('never waitlists a non-going answer', () => {
    expect(resolveWaitlisted(5, RsvpStatus.Maybe, 5)).toBe(false);
    expect(resolveWaitlisted(5, RsvpStatus.NotGoing, 10)).toBe(false);
    expect(resolveWaitlisted(5, RsvpStatus.NoResponse, 10)).toBe(false);
  });

  it('confirms a going answer while a spot is free', () => {
    expect(resolveWaitlisted(5, RsvpStatus.Going, 4)).toBe(false);
  });

  it('waitlists a going answer once capacity is reached', () => {
    expect(resolveWaitlisted(5, RsvpStatus.Going, 5)).toBe(true);
    expect(resolveWaitlisted(5, RsvpStatus.Going, 6)).toBe(true);
  });

  it('waitlists a going answer against a zero-capacity session', () => {
    expect(resolveWaitlisted(0, RsvpStatus.Going, 0)).toBe(true);
  });
});

describe('hasFreeSpot', () => {
  it('is always true for an uncapped session', () => {
    expect(hasFreeSpot(null, 100)).toBe(true);
  });

  it('is true only below capacity', () => {
    expect(hasFreeSpot(3, 2)).toBe(true);
    expect(hasFreeSpot(3, 3)).toBe(false);
  });
});

describe('isConfirmedGoing', () => {
  it('is true only for a non-waitlisted going slot', () => {
    expect(isConfirmedGoing(slot(RsvpStatus.Going, false))).toBe(true);
    expect(isConfirmedGoing(slot(RsvpStatus.Going, true))).toBe(false);
    expect(isConfirmedGoing(slot(RsvpStatus.Maybe, false))).toBe(false);
  });
});

describe('freedConfirmedSlot', () => {
  it('is false when there was no previous response', () => {
    expect(freedConfirmedSlot(null, slot(RsvpStatus.NotGoing, false))).toBe(
      false,
    );
  });

  it('is false when the previous response was not confirmed going', () => {
    expect(
      freedConfirmedSlot(
        slot(RsvpStatus.Going, true),
        slot(RsvpStatus.NotGoing, false),
      ),
    ).toBe(false);
    expect(
      freedConfirmedSlot(
        slot(RsvpStatus.Maybe, false),
        slot(RsvpStatus.NotGoing, false),
      ),
    ).toBe(false);
  });

  it('is true when a confirmed going member leaves the confirmed set', () => {
    expect(
      freedConfirmedSlot(
        slot(RsvpStatus.Going, false),
        slot(RsvpStatus.NotGoing, false),
      ),
    ).toBe(true);
    expect(
      freedConfirmedSlot(
        slot(RsvpStatus.Going, false),
        slot(RsvpStatus.Going, true),
      ),
    ).toBe(true);
  });

  it('is false when a confirmed going member stays confirmed going', () => {
    expect(
      freedConfirmedSlot(
        slot(RsvpStatus.Going, false),
        slot(RsvpStatus.Going, false),
      ),
    ).toBe(false);
  });
});
