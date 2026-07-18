import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Min } from '@core/validation';

import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';
import { BlockFieldsDto } from './block-fields.dto';

/** Body for updating an agenda block under an optimistic version guard. */
export class UpdateBlockDto extends BlockFieldsDto {
  @ApiPropertyOptional({ minimum: EXPECTED_VERSION_MIN })
  @IsOptional()
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion?: number;
}
