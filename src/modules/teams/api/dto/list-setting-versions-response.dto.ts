import { ApiProperty } from '@core/openapi';

import { SettingVersionResponseDto } from './setting-version-response.dto';

export class ListSettingVersionsResponseDto {
  @ApiProperty({ type: [SettingVersionResponseDto] })
  declare readonly items: readonly SettingVersionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
