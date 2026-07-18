import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  COLOR_MAX_LENGTH,
  LOCALE_MAX_LENGTH,
  MEDIA_KEY_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
  TIMEZONE_MAX_LENGTH,
} from '../../model/teams.constants';

export class CreateTeamDto {
  @ApiProperty({ minLength: SLUG_MIN_LENGTH, maxLength: SLUG_MAX_LENGTH })
  @IsString()
  @MinLength(SLUG_MIN_LENGTH)
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN)
  declare readonly slug: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ maxLength: LOCALE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(LOCALE_MAX_LENGTH)
  declare readonly locale?: string;

  @ApiPropertyOptional({ maxLength: TIMEZONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  declare readonly timezone?: string;

  @ApiPropertyOptional({ maxLength: COLOR_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(COLOR_MAX_LENGTH)
  declare readonly primaryColor?: string;

  @ApiPropertyOptional({ maxLength: MEDIA_KEY_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MEDIA_KEY_MAX_LENGTH)
  declare readonly logoMediaKey?: string;
}
