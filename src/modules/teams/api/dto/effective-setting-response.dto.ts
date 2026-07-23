import { ApiProperty } from '@core/openapi';

import { SettingValueState } from '../../model/setting-values.enums';
import type { TypedSettingValue } from '../../model/setting-values.types';
import { SettingKey } from '../../model/teams.enums';
import { SETTING_VALUE_SCHEMA_REFS } from './setting-values';

export class EffectiveSettingResponseDto {
  @ApiProperty({ enum: SettingKey })
  declare readonly settingKey: SettingKey;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly effectiveFrom: Date | null;

  @ApiProperty({
    oneOf: [...SETTING_VALUE_SCHEMA_REFS],
    nullable: true,
    description:
      'Typed effective value; null when the key is not configured OR the in-effect row is legacy (D4 — never served unvalidated).',
  })
  declare readonly value: TypedSettingValue | null;

  @ApiProperty({
    enum: SettingValueState,
    nullable: true,
    description: 'Null only when the key is not configured.',
  })
  declare readonly valueState: SettingValueState | null;

  @ApiProperty({
    type: [String],
    description:
      'Cross-setting issue codes (D3), e.g. weights_missing_status:<code>.',
  })
  declare readonly issues: readonly string[];
}
