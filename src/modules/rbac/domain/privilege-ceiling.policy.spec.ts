import { describe, expect, it } from 'vitest';

import { isWithinPrivilegeCeiling } from './privilege-ceiling.policy';

describe('isWithinPrivilegeCeiling', () => {
  it('is true when the actor holds every target permission', () => {
    const actor = new Set<string>([
      'team.read',
      'member.list',
      'member.invite',
    ]);

    expect(isWithinPrivilegeCeiling(actor, ['team.read', 'member.list'])).toBe(
      true,
    );
  });

  it('is false when the actor lacks any target permission', () => {
    const actor = new Set<string>(['team.read']);

    expect(
      isWithinPrivilegeCeiling(actor, ['team.read', 'member.invite']),
    ).toBe(false);
  });

  it('is true for an empty target set', () => {
    expect(isWithinPrivilegeCeiling(new Set<string>(), [])).toBe(true);
  });
});
