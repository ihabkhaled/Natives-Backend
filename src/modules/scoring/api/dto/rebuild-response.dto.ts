import { ApiProperty } from '@core/openapi';

/** The outcome of a projection rebuild batch for a team. */
export class RebuildResponseDto {
  @ApiProperty()
  declare readonly scanned: number;

  @ApiProperty()
  declare readonly rebuilt: number;

  @ApiProperty()
  declare readonly failed: number;

  @ApiProperty({ format: 'uuid' })
  declare readonly ruleId: string;

  @ApiProperty()
  declare readonly ruleVersion: number;
}
