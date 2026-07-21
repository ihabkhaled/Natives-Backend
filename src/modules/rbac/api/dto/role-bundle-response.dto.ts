import { ApiProperty } from '@core/openapi';

/** One role bundle and the catalog permission keys it grants. */
export class RoleBundleResponseDto {
  @ApiProperty({ description: 'Stable role key stored in the roles table' })
  declare readonly key: string;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty()
  declare readonly description: string;

  @ApiProperty({
    description: 'True for the system-seeded default bundles',
  })
  declare readonly isSystem: boolean;

  @ApiProperty({ type: [String] })
  declare readonly permissions: readonly string[];
}
