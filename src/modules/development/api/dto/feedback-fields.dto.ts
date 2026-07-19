import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, MaxLength } from '@core/validation';

import {
  COACH_NOTE_MAX_LENGTH,
  FEEDBACK_FIELD_MAX_LENGTH,
} from '../../model/development.constants';

/**
 * The structured, free-text coach-feedback fields. Every field is optional and
 * null-not-evaluated. `coachNote` is the PRIVATE coach-only observation: it is
 * accepted here but never projected into a member-visible view.
 */
export class FeedbackFieldsDto {
  @ApiPropertyOptional({ maxLength: FEEDBACK_FIELD_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_FIELD_MAX_LENGTH)
  readonly positiveFrisbee?: string | null;

  @ApiPropertyOptional({ maxLength: FEEDBACK_FIELD_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_FIELD_MAX_LENGTH)
  readonly frisbeeImprovement?: string | null;

  @ApiPropertyOptional({ maxLength: FEEDBACK_FIELD_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_FIELD_MAX_LENGTH)
  readonly positiveMental?: string | null;

  @ApiPropertyOptional({ maxLength: FEEDBACK_FIELD_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_FIELD_MAX_LENGTH)
  readonly mentalImprovement?: string | null;

  @ApiPropertyOptional({ maxLength: FEEDBACK_FIELD_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_FIELD_MAX_LENGTH)
  readonly teamRole?: string | null;

  @ApiPropertyOptional({ maxLength: FEEDBACK_FIELD_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_FIELD_MAX_LENGTH)
  readonly recommendedPosition?: string | null;

  @ApiPropertyOptional({ maxLength: FEEDBACK_FIELD_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_FIELD_MAX_LENGTH)
  readonly summary?: string | null;

  @ApiPropertyOptional({ maxLength: COACH_NOTE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(COACH_NOTE_MAX_LENGTH)
  readonly coachNote?: string | null;
}
