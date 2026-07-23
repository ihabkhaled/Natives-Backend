import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

import {
  ASSESSMENT_BANDS_MAX,
  ASSESSMENT_SCALE_CEILING,
  ASSESSMENT_SCALE_FLOOR,
  ASSESSMENT_SCALE_STEP_MIN,
  SETTING_CODE_PATTERN,
  SETTING_LABEL_MAX_LENGTH,
  SETTING_LABEL_MIN_LENGTH,
} from '../../../model/setting-values.constants';

/**
 * OpenAPI mirror of `AssessmentScaleValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). Documentation-only (P2, D1).
 */
export class ScaleBandDto {
  @ApiProperty({ pattern: SETTING_CODE_PATTERN.source })
  declare readonly key: string;

  @ApiProperty({
    minLength: SETTING_LABEL_MIN_LENGTH,
    maxLength: SETTING_LABEL_MAX_LENGTH,
  })
  declare readonly labelEn: string;

  @ApiProperty({
    minLength: SETTING_LABEL_MIN_LENGTH,
    maxLength: SETTING_LABEL_MAX_LENGTH,
  })
  declare readonly labelAr: string;

  @ApiProperty({
    minimum: ASSESSMENT_SCALE_FLOOR,
    maximum: ASSESSMENT_SCALE_CEILING,
  })
  declare readonly from: number;

  @ApiProperty({
    minimum: ASSESSMENT_SCALE_FLOOR,
    maximum: ASSESSMENT_SCALE_CEILING,
  })
  declare readonly to: number;
}

export class AssessmentScaleValueDto {
  @ApiProperty({
    minimum: ASSESSMENT_SCALE_FLOOR,
    maximum: ASSESSMENT_SCALE_CEILING,
  })
  declare readonly min: number;

  @ApiProperty({
    minimum: ASSESSMENT_SCALE_FLOOR,
    maximum: ASSESSMENT_SCALE_CEILING,
  })
  declare readonly max: number;

  @ApiProperty({
    minimum: ASSESSMENT_SCALE_STEP_MIN,
    description: '(max − min) must be divisible by step.',
  })
  declare readonly step: number;

  @ApiPropertyOptional({
    type: [ScaleBandDto],
    maxItems: ASSESSMENT_BANDS_MAX,
    description:
      'Ascending, non-overlapping bands inside [min, max]; gaps are legal.',
  })
  declare readonly bands?: readonly ScaleBandDto[];
}
