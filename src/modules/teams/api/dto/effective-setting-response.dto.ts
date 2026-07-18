import { ApiProperty } from '@core/openapi';

import { SettingKey } from '../../model/teams.enums';
import type { JsonObject } from '../../model/teams.types';

export class EffectiveSettingResponseDto {
  @ApiProperty({ enum: SettingKey })
  declare readonly settingKey: SettingKey;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly effectiveFrom: Date | null;

  @ApiProperty({ type: Object, nullable: true })
  declare readonly value: JsonObject | null;
}
