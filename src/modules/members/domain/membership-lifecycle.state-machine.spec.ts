import { describe, expect, it } from 'vitest';

import { MembershipStatus } from '../model/members.enums';
import {
  allowedTransitions,
  canEditProfile,
  canMutateTeamData,
  canSelfEditProfile,
  canTransition,
  isTerminal,
} from './membership-lifecycle.state-machine';

describe('membership-lifecycle.state-machine', () => {
  describe('canTransition', () => {
    it('allows invited -> active', () => {
      expect(
        canTransition(MembershipStatus.Invited, MembershipStatus.Active),
      ).toBe(true);
    });

    it('allows active -> inactive/suspended/left/archived/anonymized', () => {
      for (const to of [
        MembershipStatus.Inactive,
        MembershipStatus.Suspended,
        MembershipStatus.Left,
        MembershipStatus.Archived,
        MembershipStatus.Anonymized,
      ]) {
        expect(canTransition(MembershipStatus.Active, to)).toBe(true);
      }
    });

    it('allows restoring inactive/suspended/archived back to active', () => {
      expect(
        canTransition(MembershipStatus.Inactive, MembershipStatus.Active),
      ).toBe(true);
      expect(
        canTransition(MembershipStatus.Suspended, MembershipStatus.Active),
      ).toBe(true);
      expect(
        canTransition(MembershipStatus.Archived, MembershipStatus.Active),
      ).toBe(true);
    });

    it('rejects an identity transition', () => {
      expect(
        canTransition(MembershipStatus.Active, MembershipStatus.Active),
      ).toBe(false);
    });

    it('rejects moving out of anonymized (terminal)', () => {
      expect(
        canTransition(MembershipStatus.Anonymized, MembershipStatus.Active),
      ).toBe(false);
    });

    it('rejects reactivating a member who left', () => {
      expect(
        canTransition(MembershipStatus.Left, MembershipStatus.Active),
      ).toBe(false);
    });

    it('allows a left member to be archived or anonymized', () => {
      expect(
        canTransition(MembershipStatus.Left, MembershipStatus.Archived),
      ).toBe(true);
      expect(
        canTransition(MembershipStatus.Left, MembershipStatus.Anonymized),
      ).toBe(true);
    });
  });

  describe('allowedTransitions', () => {
    it('returns the target set for a state', () => {
      expect(allowedTransitions(MembershipStatus.Invited)).toContain(
        MembershipStatus.Active,
      );
    });

    it('returns an empty set for the terminal state', () => {
      expect(allowedTransitions(MembershipStatus.Anonymized)).toEqual([]);
    });
  });

  describe('isTerminal', () => {
    it('is true only for anonymized', () => {
      expect(isTerminal(MembershipStatus.Anonymized)).toBe(true);
      expect(isTerminal(MembershipStatus.Active)).toBe(false);
    });
  });

  describe('canMutateTeamData', () => {
    it('is true only for active memberships', () => {
      expect(canMutateTeamData(MembershipStatus.Active)).toBe(true);
      expect(canMutateTeamData(MembershipStatus.Suspended)).toBe(false);
      expect(canMutateTeamData(MembershipStatus.Inactive)).toBe(false);
    });
  });

  describe('canEditProfile', () => {
    it('forbids editing an anonymized profile', () => {
      expect(canEditProfile(MembershipStatus.Anonymized)).toBe(false);
      expect(canEditProfile(MembershipStatus.Archived)).toBe(true);
    });
  });

  describe('canSelfEditProfile', () => {
    it('permits self-edit only while active', () => {
      expect(canSelfEditProfile(MembershipStatus.Active)).toBe(true);
      expect(canSelfEditProfile(MembershipStatus.Inactive)).toBe(false);
    });
  });
});
