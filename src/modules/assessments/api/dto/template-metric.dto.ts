import { ApiProperty } from '@core/openapi';
import { IsBoolean, IsInt, IsUUID, Max, Min } from '@core/validation';

import {
  SORT_ORDER_MAX,
  SORT_ORDER_MIN,
} from '../../model/assessments.constants';

/**
 * One metric slot in a template: a pinned metric definition version, whether it is
 * required, and its deterministic position. Positions are unique within a template.
 */
export class TemplateMetricDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly metricDefinitionId: string;

  @ApiProperty()
  @IsBoolean()
  declare readonly required: boolean;

  @ApiProperty({ maximum: SORT_ORDER_MAX, minimum: SORT_ORDER_MIN })
  @IsInt()
  @Min(SORT_ORDER_MIN)
  @Max(SORT_ORDER_MAX)
  declare readonly sortOrder: number;
}
