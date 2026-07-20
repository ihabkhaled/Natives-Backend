import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsBoolean,
  IsEnum,
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
  DEFAULT_MAX_SIZE,
  DEFAULT_MIN_SIZE,
  MIN_WOMEN_MIN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NOTES_MAX_LENGTH,
  ROSTER_SIZE_MAX,
  ROSTER_SIZE_MIN,
} from '../../model/rosters.constants';
import { RosterDivision } from '../../model/rosters.enums';

/**
 * Request body to create a DRAFT match roster for one fixture. Naming a source
 * roster copies its active entries as they stand right now — a point-in-time
 * copy, never a live link to the competition roster.
 */
export class CreateMatchRosterDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly fixtureId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly sourceRosterId?: string | null;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ enum: RosterDivision })
  @IsOptional()
  @IsEnum(RosterDivision)
  readonly division?: RosterDivision;

  @ApiPropertyOptional({
    minimum: ROSTER_SIZE_MIN,
    maximum: ROSTER_SIZE_MAX,
    default: DEFAULT_MIN_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(ROSTER_SIZE_MIN)
  @Max(ROSTER_SIZE_MAX)
  readonly minSize?: number;

  @ApiPropertyOptional({
    minimum: ROSTER_SIZE_MIN,
    maximum: ROSTER_SIZE_MAX,
    default: DEFAULT_MAX_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(ROSTER_SIZE_MIN)
  @Max(ROSTER_SIZE_MAX)
  readonly maxSize?: number;

  @ApiPropertyOptional({
    minimum: MIN_WOMEN_MIN,
    maximum: ROSTER_SIZE_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_WOMEN_MIN)
  @Max(ROSTER_SIZE_MAX)
  readonly minWomen?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  readonly requireCaptain?: boolean;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
