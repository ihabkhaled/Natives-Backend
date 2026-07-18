import { ApiProperty } from '@core/openapi';

export class EffectivePermissionsResponseDto {
  @ApiProperty()
  declare readonly userId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: [String] })
  declare readonly permissions: readonly string[];
}
