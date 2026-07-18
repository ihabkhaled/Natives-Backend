import { ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from '@core/validation';

import { REASON_MAX_LENGTH } from '../../model/members.constants';

/**
 * Common body for a lifecycle transition (activate/deactivate/suspend/restore/
 * leave/archive/anonymize). Both fields are optional: an omitted effective time
 * defaults to now (UTC). The actor is taken from the token.
 */
export class TransitionDto {
  @ApiPropertyOptional({ maxLength: REASON_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  declare readonly effectiveAt?: string;
}
