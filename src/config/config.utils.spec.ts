import { describe, expect, it } from 'vitest';

import {
  parseBoolean,
  parseCsv,
  parseInteger,
  parseNodeEnv,
  requireConfigValue,
} from './config.utils';

describe('config utils', () => {
  it('parses and trims comma-separated values', () => {
    expect(parseCsv(' https://one.example,https://two.example ')).toEqual([
      'https://one.example',
      'https://two.example',
    ]);
  });

  it('returns an empty list for missing or blank CSV input', () => {
    expect(parseCsv(undefined)).toEqual([]);
    expect(parseCsv('  ')).toEqual([]);
  });

  it('parses an integer and falls back for missing input', () => {
    expect(parseInteger('42', 10)).toBe(42);
    expect(parseInteger(undefined, 10)).toBe(10);
  });

  it('parses explicit boolean strings and uses the fallback when missing', () => {
    expect(parseBoolean('true', false)).toBe(true);
    expect(parseBoolean('false', true)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
  });

  it('rejects an invalid boolean string', () => {
    expect(() => parseBoolean('yes', false)).toThrow(
      'Invalid boolean configuration value',
    );
  });

  it('returns a required configuration value when present', () => {
    expect(requireConfigValue('secret-value', 'JWT_SECRET')).toBe(
      'secret-value',
    );
  });

  it('rejects a missing required configuration value', () => {
    expect(() => requireConfigValue(undefined, 'JWT_SECRET')).toThrow(
      'Required configuration value is missing: JWT_SECRET',
    );
  });

  it('parses a supported node environment', () => {
    expect(parseNodeEnv('production')).toBe('production');
  });

  it('rejects an unsupported node environment', () => {
    expect(() => parseNodeEnv('preview')).toThrow('NODE_ENV is invalid');
  });
});
