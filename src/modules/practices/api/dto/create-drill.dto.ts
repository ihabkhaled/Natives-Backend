import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID } from '@core/validation';

import { DrillFieldsDto } from './drill-fields.dto';

/** Body for creating a catalog drill. Optionally scoped to a season. */
export class CreateDrillDto extends DrillFieldsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly seasonId?: string;
}
