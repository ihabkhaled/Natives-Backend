import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/development.constants';
import { FeedbackFieldsDto } from './feedback-fields.dto';

/** Request body to correct a published feedback via a new revision. */
export class CorrectFeedbackDto {
  @ApiProperty({ minLength: REASON_MIN_LENGTH, maxLength: REASON_MAX_LENGTH })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;

  @ApiPropertyOptional({ type: FeedbackFieldsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackFieldsDto)
  readonly fields?: FeedbackFieldsDto;
}
