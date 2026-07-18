import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Min } from '@core/validation';

import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';
import { DrillFieldsDto } from './drill-fields.dto';

/** Body for updating a catalog drill under an optimistic version guard. */
export class UpdateDrillDto extends DrillFieldsDto {
  @ApiPropertyOptional({ minimum: EXPECTED_VERSION_MIN })
  @IsOptional()
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion?: number;
}
