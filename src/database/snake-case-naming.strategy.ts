import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

import { toSnakeCase } from './naming.helpers';

/**
 * Enforces the snake_case table/column convention across every entity so the
 * physical schema stays consistent regardless of TypeScript property casing.
 */
export class SnakeCaseNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override tableName(
    className: string,
    customName: string | undefined,
  ): string {
    return customName ?? toSnakeCase(className);
  }

  override columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    const base = customName.length > 0 ? customName : propertyName;
    return toSnakeCase([...embeddedPrefixes, base].join('_'));
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }
}
