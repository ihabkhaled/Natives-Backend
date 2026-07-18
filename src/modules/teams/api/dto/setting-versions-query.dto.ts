import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsEnum, IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/teams.constants';
import { SettingKey } from '../../model/teams.enums';

export class SettingVersionsQueryDto {
  @ApiProperty({ enum: SettingKey })
  @IsEnum(SettingKey)
  declare readonly settingKey: SettingKey;

  @ApiPropertyOptional({
    default: LIST_DEFAULT_LIMIT,
    maximum: LIST_MAX_LIMIT,
    minimum: LIST_MIN_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  @IsOptional()
  readonly limit?: number;

  @ApiPropertyOptional({
    default: LIST_DEFAULT_OFFSET,
    minimum: LIST_DEFAULT_OFFSET,
  })
  @Type(() => Number)
  @IsInt()
  @Min(LIST_DEFAULT_OFFSET)
  @IsOptional()
  readonly offset?: number;
}
