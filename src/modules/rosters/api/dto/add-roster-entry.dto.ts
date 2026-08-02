import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  JERSEY_NUMBER_PATTERN,
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
    type: String,
    pattern: JERSEY_NUMBER_PATTERN.source,
    nullable: true,
    description: 'Shirt number exactly as printed, including any leading zero',
  })
  @IsOptional()
  @IsString()
  @Matches(JERSEY_NUMBER_PATTERN)
  readonly jerseyNumber?: string | null;

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
