import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Min } from '@core/validation';

import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';

/** Optimistic-version guard body for a publish, complete, or reorder action. */
export class AgendaVersionDto {
  @ApiPropertyOptional({ minimum: EXPECTED_VERSION_MIN })
  @IsOptional()
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion?: number;
}
