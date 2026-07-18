import { ApiProperty } from '@core/openapi';

import { EffectiveSettingResponseDto } from './effective-setting-response.dto';

export class SettingsSnapshotResponseDto {
  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly asOf: Date;

  @ApiProperty({ type: [EffectiveSettingResponseDto] })
  declare readonly settings: readonly EffectiveSettingResponseDto[];
}
