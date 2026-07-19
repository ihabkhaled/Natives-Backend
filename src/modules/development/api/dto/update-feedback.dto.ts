import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Min, Type, ValidateNested } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/development.constants';
import { FeedbackFieldsDto } from './feedback-fields.dto';

/** Request body to autosave a DRAFT feedback's structured fields. */
export class UpdateFeedbackDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({ type: FeedbackFieldsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackFieldsDto)
  readonly fields?: FeedbackFieldsDto;
}
