import { describe, expect, it } from 'vitest';

import {
  ConstraintCode,
  ConstraintSeverity,
  RosterAvailabilityStatus,
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterLine,
  RosterMemberStatus,
  RosterPosition,
} from '../model/rosters.enums';
import type {
  RosterCandidate,
  RosterConstraints,
  RosterEntry,
} from '../model/rosters.types';
import {
  activeEntries,
  bucketGender,
  deduplicateJerseys,
  evaluateConstraints,
  isPublishable,
  summarizeComposition,
} from './roster-composition.policy';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function entry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    entryId: 'entry-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    jerseyNumber: 7,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    genderBucket: RosterGenderBucket.Men,
    status: RosterEntryStatus.Selected,
    availability: null,
    selectionReason: null,
    constraintOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: 'user-1',
    removedBy: null,
    removedAt: null,
    removalReason: null,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function constraints(
  overrides: Partial<RosterConstraints> = {},
): RosterConstraints {
  return {
    division: RosterDivision.Mixed,
    minSize: 1,
    maxSize: 10,
    minWomen: null,
    requireCaptain: false,
    ...overrides,
  };
}

function candidate(overrides: Partial<RosterCandidate> = {}): RosterCandidate {
  return {
    membershipId: 'member-1',
    memberStatus: RosterMemberStatus.Active,
    gender: 'man',
    jerseyNumber: 7,
    availability: null,
    selectedInSquad: true,
    ...overrides,
  };
}

describe('roster-composition.policy', () => {
  it('buckets each recognized gender token and keeps the rest unknown', () => {
    expect(bucketGender('man')).toBe(RosterGenderBucket.Men);
    expect(bucketGender('woman')).toBe(RosterGenderBucket.Women);
    expect(bucketGender('nonbinary')).toBe(RosterGenderBucket.Mixed);
    expect(bucketGender('undisclosed')).toBe(RosterGenderBucket.Unknown);
    expect(bucketGender(null)).toBe(RosterGenderBucket.Unknown);
  });

  it('measures only the active entries, never the withdrawn ones', () => {
    const entries = [
      entry(),
      entry({
        entryId: 'entry-2',
        membershipId: 'member-2',
        jerseyNumber: 8,
        status: RosterEntryStatus.Withdrawn,
      }),
    ];
    expect(activeEntries(entries)).toHaveLength(1);
    expect(summarizeComposition(entries).selected).toBe(1);
  });

  it('counts genders, lines, roles, jerseys, and unavailable selections', () => {
    const composition = summarizeComposition([
      entry({ lineAssignment: RosterLine.Offense }),
      entry({
        entryId: 'entry-2',
        membershipId: 'member-2',
        jerseyNumber: 8,
        genderBucket: RosterGenderBucket.Women,
        lineAssignment: RosterLine.Defense,
        entryRole: RosterEntryRole.Captain,
      }),
      entry({
        entryId: 'entry-3',
        membershipId: 'member-3',
        jerseyNumber: null,
        genderBucket: RosterGenderBucket.Mixed,
        entryRole: RosterEntryRole.SpiritCaptain,
        availability: RosterAvailabilityStatus.Unavailable,
      }),
      entry({
        entryId: 'entry-4',
        membershipId: 'member-4',
        jerseyNumber: 7,
        genderBucket: RosterGenderBucket.Unknown,
      }),
    ]);
    expect(composition).toEqual({
      selected: 4,
      women: 1,
      men: 1,
      mixed: 1,
      unknownGender: 1,
      offense: 1,
      defense: 1,
      flexible: 2,
      captains: 1,
      spiritCaptains: 1,
      missingJersey: 1,
      duplicateJerseys: 1,
      unavailableSelected: 1,
    });
  });

  it('raises a blocking violation below the minimum size', () => {
    const violations = evaluateConstraints(
      summarizeComposition([entry()]),
      constraints({ minSize: 5 }),
    );
    expect(violations).toContainEqual({
      code: ConstraintCode.MinSize,
      severity: ConstraintSeverity.Error,
      count: 1,
    });
    expect(isPublishable(violations)).toBe(false);
  });

  it('raises a blocking violation above the maximum size', () => {
    const violations = evaluateConstraints(
      summarizeComposition([
        entry(),
        entry({
          entryId: 'entry-2',
          membershipId: 'member-2',
          jerseyNumber: 8,
        }),
      ]),
      constraints({ maxSize: 1 }),
    );
    expect(violations[0]).toEqual({
      code: ConstraintCode.MaxSize,
      severity: ConstraintSeverity.Error,
      count: 2,
    });
  });

  it('requires a captain only when the roster asks for one', () => {
    const composition = summarizeComposition([entry()]);
    expect(
      evaluateConstraints(composition, constraints({ requireCaptain: true })),
    ).toContainEqual({
      code: ConstraintCode.MissingCaptain,
      severity: ConstraintSeverity.Error,
      count: 0,
    });
    expect(
      evaluateConstraints(composition, constraints({ requireCaptain: false })),
    ).not.toContainEqual(
      expect.objectContaining({ code: ConstraintCode.MissingCaptain }),
    );
  });

  it('accepts a roster whose captain is present', () => {
    const violations = evaluateConstraints(
      summarizeComposition([entry({ entryRole: RosterEntryRole.Captain })]),
      constraints({ requireCaptain: true }),
    );
    expect(isPublishable(violations)).toBe(true);
  });

  it('blocks a jersey collision between two selected players', () => {
    const violations = evaluateConstraints(
      summarizeComposition([
        entry(),
        entry({ entryId: 'entry-2', membershipId: 'member-2' }),
      ]),
      constraints(),
    );
    expect(violations).toContainEqual({
      code: ConstraintCode.JerseyCollision,
      severity: ConstraintSeverity.Error,
      count: 1,
    });
  });

  it('skips the gender rule entirely when no minimum is set (null, not zero)', () => {
    const violations = evaluateConstraints(
      summarizeComposition([entry()]),
      constraints({ minWomen: null }),
    );
    expect(violations).not.toContainEqual(
      expect.objectContaining({ code: ConstraintCode.GenderRatio }),
    );
  });

  it('blocks an unmet gender minimum and accepts a met one', () => {
    const menOnly = summarizeComposition([entry()]);
    expect(
      evaluateConstraints(menOnly, constraints({ minWomen: 1 })),
    ).toContainEqual({
      code: ConstraintCode.GenderRatio,
      severity: ConstraintSeverity.Error,
      count: 0,
    });
    const balanced = summarizeComposition([
      entry(),
      entry({
        entryId: 'entry-2',
        membershipId: 'member-2',
        jerseyNumber: 8,
        genderBucket: RosterGenderBucket.Women,
      }),
    ]);
    expect(
      evaluateConstraints(balanced, constraints({ minWomen: 1 })),
    ).not.toContainEqual(
      expect.objectContaining({ code: ConstraintCode.GenderRatio }),
    );
  });

  it('reports missing jerseys, unavailable selections, and line imbalance as advisory only', () => {
    const violations = evaluateConstraints(
      summarizeComposition([
        entry({
          jerseyNumber: null,
          lineAssignment: RosterLine.Offense,
          availability: RosterAvailabilityStatus.Unavailable,
        }),
      ]),
      constraints(),
    );
    expect(violations.map(item => item.code)).toEqual([
      ConstraintCode.MissingJersey,
      ConstraintCode.UnavailableSelected,
      ConstraintCode.LineBalance,
    ]);
    expect(
      violations.every(item => item.severity === ConstraintSeverity.Warning),
    ).toBe(true);
    expect(isPublishable(violations)).toBe(true);
  });

  it('reports no line imbalance when both lines are represented', () => {
    const violations = evaluateConstraints(
      summarizeComposition([
        entry({ lineAssignment: RosterLine.Offense }),
        entry({
          entryId: 'entry-2',
          membershipId: 'member-2',
          jerseyNumber: 8,
          lineAssignment: RosterLine.Defense,
        }),
      ]),
      constraints(),
    );
    expect(violations).toEqual([]);
    expect(isPublishable(violations)).toBe(true);
  });

  it('keeps the first repeated jersey and clears the rest, never inventing one', () => {
    const resolved = deduplicateJerseys([
      candidate(),
      candidate({ membershipId: 'member-2', jerseyNumber: 7 }),
      candidate({ membershipId: 'member-3', jerseyNumber: 9 }),
      candidate({ membershipId: 'member-4', jerseyNumber: null }),
    ]);
    expect(resolved.map(item => item.jerseyNumber)).toEqual([7, null, 9, null]);
  });
});
