import { ApiProperty } from '@core/openapi';

import {
  AssessmentScaleKind,
  AssessmentStatus,
} from '../../model/assessments.enums';

/**
 * A configurable measurement scale. Bounds are nullable on purpose: an open-ended
 * scale (timed, count, text, categorical) leaves them null rather than defaulting
 * to zero, preserving the null-not-zero invariant end to end.
 */
export class ScaleResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty()
  declare readonly key: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ enum: AssessmentScaleKind })
  declare readonly valueKind: AssessmentScaleKind;

  @ApiProperty({ type: String, nullable: true })
  declare readonly unit: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly minimumValue: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly maximumValue: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly stepValue: number | null;

  @ApiProperty({ type: [String] })
  declare readonly categoricalOptions: readonly string[];

  @ApiProperty()
  declare readonly guidance: string;

  @ApiProperty({ enum: AssessmentStatus })
  declare readonly status: AssessmentStatus;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
