import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
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
  JERSEY_NUMBER_MAX,
  JERSEY_NUMBER_MIN,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/rosters.constants';
import {
  RosterEntryRole,
  RosterLine,
  RosterPosition,
} from '../../model/rosters.enums';

/**
 * Request body to add a player to a roster. A candidate no rule flags is added
 * directly; a flagged one is refused here and must go through the override
 * endpoint — the flag is advisory, the decision is a permitted human's.
 */
export class AddRosterEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiPropertyOptional({
    minimum: JERSEY_NUMBER_MIN,
    maximum: JERSEY_NUMBER_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(JERSEY_NUMBER_MIN)
  @Max(JERSEY_NUMBER_MAX)
  readonly jerseyNumber?: number | null;

  @ApiPropertyOptional({
    enum: RosterEntryRole,
    default: RosterEntryRole.Player,
  })
  @IsOptional()
  @IsEnum(RosterEntryRole)
  readonly entryRole?: RosterEntryRole;

  @ApiPropertyOptional({ enum: RosterLine, default: RosterLine.Any })
  @IsOptional()
  @IsEnum(RosterLine)
  readonly lineAssignment?: RosterLine;

  @ApiPropertyOptional({
    enum: RosterPosition,
    default: RosterPosition.Unspecified,
  })
  @IsOptional()
  @IsEnum(RosterPosition)
  readonly fieldPosition?: RosterPosition;

  @ApiPropertyOptional({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  readonly selectionReason?: string | null;
}
