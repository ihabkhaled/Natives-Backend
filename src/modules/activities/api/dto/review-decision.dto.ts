import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, IsString, MaxLength, Min } from '@core/validation';

import {
  RECORD_VERSION_MIN,
  REVIEW_NOTE_MAX_LENGTH,
} from '../../model/activities.constants';

/**
 * A reviewer's approve / reject / request-changes decision body. The optimistic
 * version guards a concurrent change. The reviewer note is optional here but is
 * required for denial decisions, enforced by the domain policy — never the DTO.
 */
export class ReviewDecisionDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({ maxLength: REVIEW_NOTE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_NOTE_MAX_LENGTH)
  readonly reviewNote?: string | null;
}
