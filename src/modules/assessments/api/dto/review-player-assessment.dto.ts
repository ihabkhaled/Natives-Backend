import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from '@core/validation';

import {
  NOTE_MAX_LENGTH,
  RECORD_VERSION_MIN,
} from '../../model/player-assessments.constants';
import { ReviewDecision } from '../../model/player-assessments.enums';

/**
 * A reviewer's decision on a submitted assessment: claim review, approve, or
 * reopen. Approving one's own assessment is forbidden and rejected by the domain.
 */
export class ReviewPlayerAssessmentDto {
  @ApiProperty({ enum: ReviewDecision })
  @IsEnum(ReviewDecision)
  declare readonly decision: ReviewDecision;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({ maxLength: NOTE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  readonly note?: string | null;
}
