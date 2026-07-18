import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from '@core/validation';

import { NOTE_MAX_LENGTH } from '../../model/teams.constants';
import { SettingKey } from '../../model/teams.enums';
import type { JsonObject } from '../../model/teams.types';

export class CreateSettingVersionDto {
  @ApiProperty({ enum: SettingKey })
  @IsEnum(SettingKey)
  declare readonly settingKey: SettingKey;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: Object })
  @IsObject()
  declare readonly value: JsonObject;

  @ApiPropertyOptional({ maxLength: NOTE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  declare readonly note?: string;
}
