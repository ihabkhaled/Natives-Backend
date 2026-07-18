import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  ADDRESS_MAX_LENGTH,
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  TIMEZONE_MAX_LENGTH,
} from '../../model/teams.constants';

export class CreateVenueDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ maxLength: ADDRESS_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(ADDRESS_MAX_LENGTH)
  declare readonly address?: string;

  @ApiPropertyOptional({ maxLength: TIMEZONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  declare readonly timezone?: string;

  @ApiPropertyOptional({ minimum: LATITUDE_MIN, maximum: LATITUDE_MAX })
  @IsOptional()
  @IsNumber()
  @Min(LATITUDE_MIN)
  @Max(LATITUDE_MAX)
  declare readonly latitude?: number;

  @ApiPropertyOptional({ minimum: LONGITUDE_MIN, maximum: LONGITUDE_MAX })
  @IsOptional()
  @IsNumber()
  @Min(LONGITUDE_MIN)
  @Max(LONGITUDE_MAX)
  declare readonly longitude?: number;
}
