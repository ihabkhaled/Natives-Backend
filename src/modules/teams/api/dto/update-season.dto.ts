import { ApiProperty } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  DATE_PATTERN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
} from '../../model/teams.constants';
import { SeasonStatus } from '../../model/teams.enums';

export class UpdateSeasonDto {
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

  @ApiProperty({ format: 'date', example: '2026-01-01' })
  @IsString()
  @Matches(DATE_PATTERN)
  declare readonly startsOn: string;

  @ApiProperty({ format: 'date', example: '2026-06-30' })
  @IsString()
  @Matches(DATE_PATTERN)
  declare readonly endsOn: string;

  @ApiProperty({ enum: SeasonStatus })
  @IsEnum(SeasonStatus)
  declare readonly status: SeasonStatus;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  declare readonly expectedVersion: number;
}
