import { ApiProperty } from '@core/openapi';

import {
  MeasurementDirection,
  ResultPolicy,
} from '../../model/measurements.enums';

/**
 * A protocol's derived result. `selected` is the value the policy picks; `best`,
 * `average`, and `latest` are all shown for provenance. Every figure is null (not
 * zero) when no valid attempt exists.
 */
export class ResultSelectionResponseDto {
  @ApiProperty({ enum: ResultPolicy })
  declare readonly method: ResultPolicy;

  @ApiProperty({ enum: MeasurementDirection })
  declare readonly direction: MeasurementDirection;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly selected: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly best: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly average: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly latest: number | null;

  @ApiProperty()
  declare readonly consideredCount: number;

  @ApiProperty()
  declare readonly excludedCount: number;
}
