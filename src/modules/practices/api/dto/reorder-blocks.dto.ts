import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from '@core/validation';

import {
  REORDER_BLOCKS_MAX_COUNT,
  REORDER_BLOCKS_MIN_COUNT,
} from '../../model/agendas.constants';
import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';

/**
 * Body for reordering a draft agenda's blocks. `blockIds` must list exactly the
 * current blocks once each, in the desired order; `expectedVersion` guards against
 * a concurrent reorder or structural edit.
 */
export class ReorderBlocksDto {
  @ApiProperty({
    type: [String],
    minItems: REORDER_BLOCKS_MIN_COUNT,
    maxItems: REORDER_BLOCKS_MAX_COUNT,
  })
  @IsArray()
  @ArrayMinSize(REORDER_BLOCKS_MIN_COUNT)
  @ArrayMaxSize(REORDER_BLOCKS_MAX_COUNT)
  @IsUUID('all', { each: true })
  declare readonly blockIds: string[];

  @ApiPropertyOptional({ minimum: EXPECTED_VERSION_MIN })
  @IsOptional()
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion?: number;
}
