import { ApiProperty } from '@core/openapi';

/** The explained overall figure: exact arithmetic plus the rounded display value. */
export class OverallExplanationResponseDto {
  @ApiProperty({ type: Number, nullable: true })
  declare readonly unrounded: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly display: number | null;

  @ApiProperty()
  declare readonly numerator: number;

  @ApiProperty()
  declare readonly denominator: number;

  @ApiProperty()
  declare readonly includedCount: number;

  @ApiProperty()
  declare readonly excludedCount: number;

  @ApiProperty()
  declare readonly sufficient: boolean;
}
