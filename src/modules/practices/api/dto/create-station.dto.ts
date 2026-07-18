import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  AGENDA_NOTES_MAX_LENGTH,
  REPETITIONS_MAX,
  REPETITIONS_MIN,
  STATION_NAME_MAX_LENGTH,
  STATION_NAME_MIN_LENGTH,
  TARGET_MAX_LENGTH,
} from '../../model/agendas.constants';

/**
 * Body for adding a station under an agenda block. Optional drill, participant
 * group, and assigned-coach references are validated within the same scope.
 */
export class CreateStationDto {
  @ApiProperty({
    minLength: STATION_NAME_MIN_LENGTH,
    maxLength: STATION_NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(STATION_NAME_MIN_LENGTH)
  @MaxLength(STATION_NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly drillId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly groupId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly coachMembershipId?: string;

  @ApiPropertyOptional({ minimum: REPETITIONS_MIN, maximum: REPETITIONS_MAX })
  @IsOptional()
  @IsInt()
  @Min(REPETITIONS_MIN)
  @Max(REPETITIONS_MAX)
  declare readonly repetitions?: number;

  @ApiPropertyOptional({ maxLength: TARGET_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TARGET_MAX_LENGTH)
  declare readonly target?: string;

  @ApiPropertyOptional({ maxLength: AGENDA_NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(AGENDA_NOTES_MAX_LENGTH)
  declare readonly notes?: string;
}
