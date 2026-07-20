import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsBoolean,
  IsDateString,
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
 * Request body to create a DRAFT competition roster. Naming a season squad
 * generates the roster from that squad's current selections as a point-in-time
 * copy — later squad changes never rewrite it. A null `minWomen` means the
 * division ratio rule does not apply; it is never read as zero.
 */
export class CreateCompetitionRosterDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly competitionId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly squadId?: string | null;

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

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly selectionDeadline?: string | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
