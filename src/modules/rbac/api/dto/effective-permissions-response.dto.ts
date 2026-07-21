import { ApiProperty } from '@core/openapi';
import { Permission } from '@shared/enums';

export class EffectivePermissionsResponseDto {
  @ApiProperty()
  declare readonly userId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  /**
   * The resolved grants, drawn from the canonical `Permission` catalog. The
   * enum is published deliberately: clients gate navigation and route guards on
   * these strings, and a client-side value the catalog never contains can only
   * ever read as "not granted" — silently forbidding a screen. Publishing the
   * catalog turns that drift into a contract failure instead of a dead screen.
   */
  @ApiProperty({ enum: Permission, isArray: true })
  declare readonly permissions: readonly string[];
}
