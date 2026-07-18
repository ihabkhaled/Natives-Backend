import { describe, expect, it } from 'vitest';

import { SnakeCaseNamingStrategy } from './snake-case-naming.strategy';

describe('SnakeCaseNamingStrategy', () => {
  const strategy = new SnakeCaseNamingStrategy();

  it('snake_cases derived table names but honors an explicit name', () => {
    expect(strategy.tableName('TeamSeason', undefined)).toBe('team_season');
    expect(strategy.tableName('TeamSeason', 'custom_table')).toBe(
      'custom_table',
    );
  });

  it('snake_cases columns from property, custom name, and embedded prefixes', () => {
    expect(strategy.columnName('createdAt', '', [])).toBe('created_at');
    expect(strategy.columnName('id', 'user_id', [])).toBe('user_id');
    expect(strategy.columnName('street', '', ['address'])).toBe(
      'address_street',
    );
  });

  it('snake_cases relation names', () => {
    expect(strategy.relationName('teamSeason')).toBe('team_season');
  });
});
