import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from '@core/validation';

import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';
import { NOTE_MAX_LENGTH } from '../../model/rsvp.constants';
import {
  RsvpNoteVisibility,
  RsvpReasonCategory,
  RsvpStatus,
} from '../../model/rsvp.enums';

/**
 * Body for a member setting their own availability. `expectedVersion` is optional:
 * omit it on a first response; supply the last-seen version to guard a concurrent
 * edit from another device (conditional update for mobile races).
 */
export class SetRsvpDto {
  @ApiProperty({ enum: RsvpStatus })
  @IsEnum(RsvpStatus)
  declare readonly status: RsvpStatus;

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
