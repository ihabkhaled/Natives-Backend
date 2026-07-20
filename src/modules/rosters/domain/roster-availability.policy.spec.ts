import { describe, expect, it } from 'vitest';

import { RosterAvailabilityStatus, RosterStatus } from '../model/rosters.enums';
import {
  canDeclareAvailability,
  contradictsSelection,
  isDeadlinePassed,
  isDeclarationOpen,
  resolveEntryAvailability,
} from './roster-availability.policy';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const BEFORE = new Date('2026-03-01T09:59:59.999Z');
const AFTER = new Date('2026-03-01T10:00:00.001Z');

describe('roster-availability.policy', () => {
  it('keeps the declaration window open only while the roster is selectable', () => {
    expect(isDeclarationOpen(RosterStatus.Draft)).toBe(true);
    expect(isDeclarationOpen(RosterStatus.Published)).toBe(true);
    expect(isDeclarationOpen(RosterStatus.Locked)).toBe(false);
    expect(isDeclarationOpen(RosterStatus.Revised)).toBe(false);
    expect(isDeclarationOpen(RosterStatus.Archived)).toBe(false);
  });

  it('treats the deadline instant itself as passed, and no deadline as open', () => {
    expect(isDeadlinePassed(null, NOW)).toBe(false);
    expect(isDeadlinePassed(AFTER, NOW)).toBe(false);
    expect(isDeadlinePassed(NOW, NOW)).toBe(true);
    expect(isDeadlinePassed(BEFORE, NOW)).toBe(true);
  });

  it('permits a declaration only with both the window open and the deadline ahead', () => {
    expect(canDeclareAvailability(RosterStatus.Draft, null, NOW)).toBe(true);
    expect(canDeclareAvailability(RosterStatus.Published, AFTER, NOW)).toBe(
      true,
    );
    expect(canDeclareAvailability(RosterStatus.Published, BEFORE, NOW)).toBe(
      false,
    );
    expect(canDeclareAvailability(RosterStatus.Locked, null, NOW)).toBe(false);
  });

  it('freezes an undeclared availability as null, never as a refusal', () => {
    expect(resolveEntryAvailability(null)).toBeNull();
    expect(resolveEntryAvailability(RosterAvailabilityStatus.Tentative)).toBe(
      RosterAvailabilityStatus.Tentative,
    );
  });

  it('flags only an explicit "not going" as contradicting a selection', () => {
    expect(contradictsSelection(RosterAvailabilityStatus.Unavailable)).toBe(
      true,
    );
    expect(contradictsSelection(RosterAvailabilityStatus.Available)).toBe(
      false,
    );
    expect(contradictsSelection(RosterAvailabilityStatus.Tentative)).toBe(
      false,
    );
    expect(contradictsSelection(null)).toBe(false);
  });
});
