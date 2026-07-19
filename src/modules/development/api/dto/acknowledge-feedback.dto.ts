import { ApiPropertyOptional } from '@core/openapi';
import { IsBoolean, IsOptional, IsString, MaxLength } from '@core/validation';

import { CLARIFICATION_MAX_LENGTH } from '../../model/development.constants';

/** Request body for a member to acknowledge feedback, optionally asking for clarification. */
export class AcknowledgeFeedbackDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly clarificationRequested?: boolean;

  @ApiPropertyOptional({ maxLength: CLARIFICATION_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(CLARIFICATION_MAX_LENGTH)
  readonly clarificationNote?: string | null;
}
