import { ApiProperty } from '@core/openapi';

import { SettingKey } from '../../model/teams.enums';
import type { JsonObject } from '../../model/teams.types';

export class SettingVersionResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ enum: SettingKey })
  declare readonly settingKey: SettingKey;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly effectiveFrom: Date;

  @ApiProperty({ type: Object })
  declare readonly value: JsonObject;

  @ApiProperty({ type: String, nullable: true })
  declare readonly note: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
