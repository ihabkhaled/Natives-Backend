import { describe, expect, it } from 'vitest';

import { extractBearerToken } from './bearer-token.parser';

describe('extractBearerToken', () => {
  it('returns the token from a valid bearer header', () => {
    expect(extractBearerToken('Bearer token-value')).toBe('token-value');
    expect(extractBearerToken('bearer token-value')).toBe('token-value');
    expect(extractBearerToken('BEARER   token-value')).toBe('token-value');
  });

  it.each([
    undefined,
    '',
    'token-value',
    'Basic token-value',
    'Bearer',
    'Bearer ',
    'Bearer token extra',
  ])('rejects malformed authorization header %#', header => {
    expect(extractBearerToken(header)).toBeUndefined();
  });
});
