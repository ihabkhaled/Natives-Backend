import { describe, expect, it } from 'vitest';

import { PasswordHashAdapter } from './password-hash.adapter';

const PASSWORD_HASH =
  '$2b$10$HobO1TciaomoWrP6K7hnguwCCqn9dOcwHZvC8NUs8//VK2md4KxPO';

describe('PasswordHashAdapter', () => {
  const adapter = new PasswordHashAdapter();

  it('matches the plaintext password against its hash', async () => {
    await expect(adapter.matches('password', PASSWORD_HASH)).resolves.toBe(
      true,
    );
  });

  it('rejects a non-matching password', async () => {
    await expect(
      adapter.matches('wrong-password', PASSWORD_HASH),
    ).resolves.toBe(false);
  });
});
