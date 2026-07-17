import { NodeEnv } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import {
  areCorsOriginsValid,
  isProductionJwtSecretValid,
} from './config-validation.helpers';

const STRONG_SECRET = 'aB3cD4eF5gH6iJ7kL8mN9pQ0rS1tU2vW3xY4zA5bC6dE';

describe('config validation helpers', () => {
  it('validates only exact HTTP and HTTPS origins', () => {
    expect(
      areCorsOriginsValid('https://one.example,http://localhost:3000'),
    ).toBe(true);
    expect(areCorsOriginsValid('ftp://one.example')).toBe(false);
    expect(areCorsOriginsValid('https://one.example/path')).toBe(false);
  });

  it('does not apply production secret policy outside production', () => {
    expect(isProductionJwtSecretValid(NodeEnv.Development, undefined)).toBe(
      true,
    );
  });

  it('rejects missing, short, placeholder, and low-entropy production secrets', () => {
    expect(isProductionJwtSecretValid(NodeEnv.Production, undefined)).toBe(
      false,
    );
    expect(isProductionJwtSecretValid(NodeEnv.Production, 'short')).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'change-me-min-32-characters-long-secret',
      ),
    ).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ),
    ).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'secretABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      ),
    ).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG',
      ),
    ).toBe(false);
  });

  it('accepts a strong production secret', () => {
    expect(isProductionJwtSecretValid(NodeEnv.Production, STRONG_SECRET)).toBe(
      true,
    );
  });
});
