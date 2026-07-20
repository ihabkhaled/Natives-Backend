import { describe, expect, it } from 'vitest';

import {
  EntryFlagCode,
  RosterAvailabilityStatus,
  RosterMemberStatus,
} from '../model/rosters.enums';
import type { RosterCandidate } from '../model/rosters.types';
import {
  evaluateEntryFlags,
  isEntryFlagged,
  isEntryOverrideMissing,
  isOverrideExercised,
  summarizeEntryFlags,
} from './roster-entry-eligibility.policy';

function candidate(overrides: Partial<RosterCandidate> = {}): RosterCandidate {
  return {
    membershipId: 'member-1',
    memberStatus: RosterMemberStatus.Active,
    gender: 'woman',
    jerseyNumber: 7,
    availability: RosterAvailabilityStatus.Available,
    selectedInSquad: true,
    ...overrides,
  };
}

describe('roster-entry-eligibility.policy', () => {
  it('flags nothing for an active, available, squad-selected candidate', () => {
    const flags = evaluateEntryFlags(candidate(), true);
    expect(flags).toEqual([]);
    expect(isEntryFlagged(flags)).toBe(false);
    expect(isEntryOverrideMissing(flags, null)).toBe(false);
  });

  it('treats an invited member as unflagged — an invitation is not a refusal', () => {
    expect(
      evaluateEntryFlags(
        candidate({ memberStatus: RosterMemberStatus.Invited }),
        true,
      ),
    ).toEqual([]);
  });

  it('flags a suspended membership distinctly from an inactive one', () => {
    expect(
      evaluateEntryFlags(
        candidate({ memberStatus: RosterMemberStatus.Suspended }),
        false,
      ),
    ).toEqual([EntryFlagCode.MembershipSuspended]);
    for (const status of [
      RosterMemberStatus.Inactive,
      RosterMemberStatus.Left,
      RosterMemberStatus.Archived,
      RosterMemberStatus.Anonymized,
    ]) {
      expect(
        evaluateEntryFlags(candidate({ memberStatus: status }), false),
      ).toEqual([EntryFlagCode.MembershipInactive]);
    }
  });

  it('flags only an explicit "not going", never a missing declaration', () => {
    expect(
      evaluateEntryFlags(
        candidate({ availability: RosterAvailabilityStatus.Unavailable }),
        false,
      ),
    ).toEqual([EntryFlagCode.DeclaredUnavailable]);
    expect(
      evaluateEntryFlags(candidate({ availability: null }), false),
    ).toEqual([]);
    expect(
      evaluateEntryFlags(
        candidate({ availability: RosterAvailabilityStatus.Tentative }),
        false,
      ),
    ).toEqual([]);
  });

  it('flags a non-squad member only when the roster was drawn from a squad', () => {
    expect(
      evaluateEntryFlags(candidate({ selectedInSquad: false }), true),
    ).toEqual([EntryFlagCode.NotInSquad]);
    expect(
      evaluateEntryFlags(candidate({ selectedInSquad: false }), false),
    ).toEqual([]);
  });

  it('accumulates every reason in a deterministic order', () => {
    const flags = evaluateEntryFlags(
      candidate({
        memberStatus: RosterMemberStatus.Suspended,
        availability: RosterAvailabilityStatus.Unavailable,
        selectedInSquad: false,
      }),
      true,
    );
    expect(flags).toEqual([
      EntryFlagCode.MembershipSuspended,
      EntryFlagCode.DeclaredUnavailable,
      EntryFlagCode.NotInSquad,
    ]);
    expect(summarizeEntryFlags(flags)).toBe(
      'membership_suspended,declared_unavailable,not_in_squad',
    );
  });

  it('demands an override for a flagged candidate and accepts one that is given', () => {
    const flags = [EntryFlagCode.MembershipSuspended];
    expect(isEntryOverrideMissing(flags, null)).toBe(true);
    expect(
      isEntryOverrideMissing(flags, { overrideReason: 'discipline closed' }),
    ).toBe(false);
  });

  it('records an override only when a flag was actually accepted', () => {
    expect(
      isOverrideExercised([EntryFlagCode.NotInSquad], {
        overrideReason: 'late call-up',
      }),
    ).toBe(true);
    expect(isOverrideExercised([], { overrideReason: 'unnecessary' })).toBe(
      false,
    );
    expect(isOverrideExercised([EntryFlagCode.NotInSquad], null)).toBe(false);
  });

  it('summarizes an empty flag set as an empty string', () => {
    expect(summarizeEntryFlags([])).toBe('');
  });
});
