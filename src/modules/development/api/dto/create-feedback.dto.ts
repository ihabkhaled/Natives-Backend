import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID, Type, ValidateNested } from '@core/validation';

import { FeedbackFieldsDto } from './feedback-fields.dto';

/** Request body to create a DRAFT coach feedback about a member. */
export class CreateFeedbackDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiPropertyOptional({ type: FeedbackFieldsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackFieldsDto)
  readonly fields?: FeedbackFieldsDto;
}
