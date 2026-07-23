import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

import {
  SESSION_DURATION_MAX_MINUTES,
  SESSION_DURATION_MIN_MINUTES,
  SESSION_TYPES_MAX,
  SESSION_TYPES_MIN,
  SETTING_CODE_PATTERN,
  SETTING_LABEL_MAX_LENGTH,
  SETTING_LABEL_MIN_LENGTH,
} from '../../../model/setting-values.constants';
import { ColorToken } from '../../../model/setting-values.enums';

/**
 * OpenAPI mirror of `SessionTypesValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). Documentation-only (P2, D1).
 */
export class SessionTypeEntryDto {
  @ApiProperty({ pattern: SETTING_CODE_PATTERN.source })
  declare readonly code: string;

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

  @ApiProperty({ enum: ColorToken })
  declare readonly color: ColorToken;

  @ApiPropertyOptional({
    minimum: SESSION_DURATION_MIN_MINUTES,
    maximum: SESSION_DURATION_MAX_MINUTES,
  })
  declare readonly defaultDurationMinutes?: number;

  @ApiProperty()
  declare readonly active: boolean;
}

export class SessionTypesValueDto {
  @ApiProperty({
    type: [SessionTypeEntryDto],
    minItems: SESSION_TYPES_MIN,
    maxItems: SESSION_TYPES_MAX,
  })
  declare readonly types: readonly SessionTypeEntryDto[];
}
