import { ApiProperty } from '@core/openapi';

import { SettingValueState } from '../../model/setting-values.enums';
import type { TypedSettingValue } from '../../model/setting-values.types';
import { SettingKey } from '../../model/teams.enums';
import type { JsonObject } from '../../model/teams.types';
import {
  LEGACY_SETTING_VALUE_SCHEMA,
  SETTING_VALUE_SCHEMA_REFS,
} from './setting-values';

export class SettingVersionResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ enum: SettingKey })
  declare readonly settingKey: SettingKey;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly effectiveFrom: Date;

  @ApiProperty({
    oneOf: [...SETTING_VALUE_SCHEMA_REFS, LEGACY_SETTING_VALUE_SCHEMA],
    description:
      'The stored document. Typed per key when valueState is "valid"; the raw legacy document (visible for the replace flow) when "legacy".',
  })
  declare readonly value: TypedSettingValue | JsonObject;

  @ApiProperty({ enum: SettingValueState })
  declare readonly valueState: SettingValueState;

  @ApiProperty({ type: String, nullable: true })
  declare readonly note: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
