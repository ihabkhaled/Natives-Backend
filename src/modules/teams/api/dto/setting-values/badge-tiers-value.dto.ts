import { ApiProperty } from '@core/openapi';

import {
  BADGE_THRESHOLD_MAX,
  BADGE_THRESHOLD_MIN,
  BADGE_TIERS_MAX,
  BADGE_TIERS_MIN,
  SETTING_CODE_PATTERN,
  SETTING_LABEL_MAX_LENGTH,
  SETTING_LABEL_MIN_LENGTH,
} from '../../../model/setting-values.constants';
import { ColorToken } from '../../../model/setting-values.enums';

/**
 * OpenAPI mirror of `BadgeTiersValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). Documentation-only (P2, D1).
 */
export class BadgeTierDto {
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
    minimum: BADGE_THRESHOLD_MIN,
    maximum: BADGE_THRESHOLD_MAX,
    description: 'Strictly ascending in array order (array order = rank).',
  })
  declare readonly threshold: number;

  @ApiProperty({ enum: ColorToken })
  declare readonly color: ColorToken;
}

export class BadgeTiersValueDto {
  @ApiProperty({
    type: [BadgeTierDto],
    minItems: BADGE_TIERS_MIN,
    maxItems: BADGE_TIERS_MAX,
  })
  declare readonly tiers: readonly BadgeTierDto[];
}
