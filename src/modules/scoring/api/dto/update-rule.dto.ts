import { ApiProperty } from '@core/openapi';
import { IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/scoring.constants';
import { CreateRuleDto } from './create-rule.dto';

/**
 * Request body for editing a DRAFT rule. Carries the optimistic version the
 * caller last read so a concurrent edit is rejected instead of silently lost.
 */
export class UpdateRuleDto extends CreateRuleDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
