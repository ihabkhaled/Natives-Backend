import { describe, expect, it } from 'vitest';

import { toSnakeCase } from './naming.helpers';

describe('toSnakeCase', () => {
  it('converts camelCase identifiers to snake_case', () => {
    expect(toSnakeCase('createdAt')).toBe('created_at');
    expect(toSnakeCase('teamSeasonId')).toBe('team_season_id');
  });

  it('splits acronym runs before the next word', () => {
    expect(toSnakeCase('HTTPServer')).toBe('http_server');
  });

  it('leaves already-lowercase identifiers untouched', () => {
    expect(toSnakeCase('id')).toBe('id');
  });
});
