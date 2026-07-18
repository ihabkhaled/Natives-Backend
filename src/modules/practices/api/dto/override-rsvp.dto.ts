import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';
import {
  NOTE_MAX_LENGTH,
  OVERRIDE_REASON_MAX_LENGTH,
  OVERRIDE_REASON_MIN_LENGTH,
} from '../../model/rsvp.constants';
import {
  RsvpNoteVisibility,
  RsvpReasonCategory,
  RsvpStatus,
} from '../../model/rsvp.enums';

/**
 * Body for a coach/admin override of another member's availability. A `reason` is
 * mandatory (recorded on the revision and audited). The override bypasses the RSVP
 * deadline but not the session state or team scope.
 */
export class OverrideRsvpDto {
  @ApiProperty({ enum: RsvpStatus })
  @IsEnum(RsvpStatus)
  declare readonly status: RsvpStatus;

  @ApiProperty({
    minLength: OVERRIDE_REASON_MIN_LENGTH,
    maxLength: OVERRIDE_REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OVERRIDE_REASON_MIN_LENGTH)
  @MaxLength(OVERRIDE_REASON_MAX_LENGTH)
  declare readonly reason: string;

  @ApiPropertyOptional({ enum: RsvpReasonCategory })
  @IsOptional()
  @IsEnum(RsvpReasonCategory)
  declare readonly reasonCategory?: RsvpReasonCategory;

  @ApiPropertyOptional({ maxLength: NOTE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  declare readonly note?: string;

  @ApiPropertyOptional({ enum: RsvpNoteVisibility })
  @IsOptional()
  @IsEnum(RsvpNoteVisibility)
  declare readonly noteVisibility?: RsvpNoteVisibility;

  @ApiPropertyOptional({ minimum: EXPECTED_VERSION_MIN })
  @IsOptional()
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion?: number;
}
