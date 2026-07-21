import { ApiProperty } from '@core/openapi';

/** One canonical permission of the seeded catalog. */
export class PermissionCatalogEntryResponseDto {
  @ApiProperty({ description: 'Canonical dot-delimited permission key' })
  declare readonly key: string;

  @ApiProperty({ description: 'Catalog area the permission is grouped under' })
  declare readonly area: string;

  @ApiProperty({ description: 'Short human description of the permission' })
  declare readonly description: string;
}
