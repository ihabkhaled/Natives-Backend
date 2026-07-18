import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordCredentialRepository } from './password-credential.repository';

function createScope(): { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() };
}

describe('PasswordCredentialRepository', () => {
  let repository: PasswordCredentialRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new PasswordCredentialRepository();
    scope = createScope();
  });

  it('inserts a password credential row', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-01T00:00:00.000Z');

    await repository.insert(
      scope as unknown as TransactionScope,
      'cred-1',
      'user-1',
      '$2b$10$hash',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "password_credentials"');
    expect(params).toEqual([
      'cred-1',
      'user-1',
      '$2b$10$hash',
      now.toISOString(),
    ]);
  });

  it('replaces the credential for a user and bumps the version', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-02T00:00:00.000Z');

    await repository.replaceForUser(
      scope as unknown as TransactionScope,
      'user-1',
      '$2b$10$newhash',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "password_credentials"');
    expect(sql).toContain('"version" = "version" + 1');
    expect(params).toEqual(['user-1', '$2b$10$newhash', now.toISOString()]);
  });
});
