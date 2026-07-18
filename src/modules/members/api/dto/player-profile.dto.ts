import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
} from '@core/validation';

import {
  DATE_PATTERN,
  DIVISION_KEY_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  JERSEY_NUMBER_MAX,
  JERSEY_NUMBER_MIN,
  JERSEY_SIZE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  POSITION_KEY_MAX_LENGTH,
  POSITIONS_MAX_COUNT,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from '../../model/members.constants';
import { PlayerGender } from '../../model/members.enums';

/**
 * Player profile fields shared by invite and profile-update. Contact and
 * measurement fields are optional (null-not-zero: absent means not evaluated, not
 * zero). The date of birth format is validated here; impossible calendar dates
 * are rejected by the application layer.
 */
export class PlayerProfileDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly fullName: string;

  @ApiPropertyOptional({ maxLength: NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly preferredName?: string;

  @ApiPropertyOptional({ maxLength: NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly fullNameAr?: string;

  @ApiPropertyOptional({ maxLength: NICKNAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NICKNAME_MAX_LENGTH)
  declare readonly nickname?: string;

  @ApiPropertyOptional({ maxLength: EMAIL_MAX_LENGTH })
  @IsOptional()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  declare readonly email?: string;

  @ApiPropertyOptional({ maxLength: PHONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(PHONE_MAX_LENGTH)
  declare readonly phone?: string;

  @ApiPropertyOptional({ enum: PlayerGender })
  @IsOptional()
  @IsEnum(PlayerGender)
  declare readonly gender?: PlayerGender;

  @ApiPropertyOptional({ maxLength: DIVISION_KEY_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(DIVISION_KEY_MAX_LENGTH)
  declare readonly division?: string;

  @ApiPropertyOptional({ type: [String], maxItems: POSITIONS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POSITIONS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(POSITION_KEY_MAX_LENGTH, { each: true })
  declare readonly positions?: string[];

  @ApiPropertyOptional({
    minimum: JERSEY_NUMBER_MIN,
    maximum: JERSEY_NUMBER_MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(JERSEY_NUMBER_MIN)
  @Max(JERSEY_NUMBER_MAX)
  declare readonly jerseyNumber?: number;

  @ApiPropertyOptional({ maxLength: JERSEY_SIZE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(JERSEY_SIZE_MAX_LENGTH)
  declare readonly jerseySize?: string;

  @ApiPropertyOptional({ minimum: HEIGHT_CM_MIN, maximum: HEIGHT_CM_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(HEIGHT_CM_MIN)
  @Max(HEIGHT_CM_MAX)
  declare readonly heightCm?: number;

  @ApiPropertyOptional({ minimum: WEIGHT_KG_MIN, maximum: WEIGHT_KG_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(WEIGHT_KG_MIN)
  @Max(WEIGHT_KG_MAX)
  declare readonly weightKg?: number;

  @ApiPropertyOptional({ example: '2000-01-31' })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  declare readonly dateOfBirth?: string;
}
