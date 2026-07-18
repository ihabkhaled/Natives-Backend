import { describe, expect, it } from 'vitest';

import { OPAQUE_TOKEN_MIN_LENGTH } from '../model/identity.constants';
import { CryptoSecureRandomAdapter } from './crypto-secure-random.adapter';

describe('CryptoSecureRandomAdapter', () => {
  it('generates a base64url token', () => {
    const token = new CryptoSecureRandomAdapter().generateToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates a token longer than the opaque-token minimum', () => {
    const token = new CryptoSecureRandomAdapter().generateToken();

    expect(token.length).toBeGreaterThan(OPAQUE_TOKEN_MIN_LENGTH);
  });

  it('produces a different token on each call', () => {
    const adapter = new CryptoSecureRandomAdapter();

    expect(adapter.generateToken()).not.toBe(adapter.generateToken());
  });
});
