import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { GovernanceJerseyReadGrants1725400000000 } from './1725400000000-governance-jersey-read-grants';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

function statementsOf(queryRunner: ReturnType<typeof runner>): string {
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

function parametersOf(
  queryRunner: ReturnType<typeof runner>,
): readonly unknown[] {
  return queryRunner.query.mock.calls.map(call => call[1]);
}

const EXPECTED_GRANTS: readonly (readonly [string, string])[] = [
  ['MEMBER', 'rules.read'],
  ['MEMBER', 'jersey.read'],
  ['COACH', 'rules.read'],
  ['COACH', 'jersey.read'],
  ['TEAM_ADMIN', 'rules.read'],
  ['TEAM_ADMIN', 'jersey.read'],
  ['TEAM_ADMIN', 'governance.read'],
];

describe('GovernanceJerseyReadGrants1725400000000', () => {
  it('seeds the seven read grants idempotently and bumps the policy version', async () => {
    const queryRunner = runner();
    await new GovernanceJerseyReadGrants1725400000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = statementsOf(queryRunner);
    expect(statements).toContain('INSERT INTO "role_permissions"');
    expect(statements).toContain('ON CONFLICT DO NOTHING');
    expect(statements).toContain('UPDATE "rbac_policy_version"');
    const parameters = parametersOf(queryRunner);
    for (const [index, grant] of EXPECTED_GRANTS.entries()) {
      expect(parameters[index]).toEqual(grant);
    }
  });

  it('never grants the analyst bundle a governance or jersey read', async () => {
    const queryRunner = runner();
    await new GovernanceJerseyReadGrants1725400000000().up(
      queryRunner as never as QueryRunner,
    );
    for (const parameters of parametersOf(queryRunner)) {
      expect(parameters?.[0]).not.toBe('ANALYST');
      expect(parameters?.[0]).not.toBe('SCOREKEEPER');
    }
  });

  it('disambiguates the governance vs points calculation rules descriptions', async () => {
    const queryRunner = runner();
    await new GovernanceJerseyReadGrants1725400000000().up(
      queryRunner as never as QueryRunner,
    );
    const parameters = parametersOf(queryRunner);
    expect(parameters).toContainEqual([
      'rules.manage',
      'Manage governance team rules',
    ]);
    expect(parameters).toContainEqual([
      'points.rules.manage',
      'Manage points calculation rules',
    ]);
  });

  it('removes exactly these grants on down and bumps the policy version', async () => {
    const queryRunner = runner();
    await new GovernanceJerseyReadGrants1725400000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = statementsOf(queryRunner);
    expect(statements).toContain('DELETE FROM "role_permissions"');
    expect(statements).toContain('UPDATE "rbac_policy_version"');
    const parameters = parametersOf(queryRunner);
    for (const [index, grant] of EXPECTED_GRANTS.entries()) {
      expect(parameters[index]).toEqual(grant);
    }
    expect(parameters).toContainEqual(['rules.manage', 'Manage rules']);
  });
});
