import { ApiProperty } from '@core/openapi';

import {
  ATTENDANCE_WEIGHT_MAX,
  ATTENDANCE_WEIGHT_MIN,
} from '../../../model/setting-values.constants';

/**
 * OpenAPI mirror of `AttendanceWeightsValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). Every key must be an ACTIVE status code of
 * the `attendance_statuses` effective at this version's instant, with full
 * coverage of active counts-toward statuses (P2, D3).
 */
export class AttendanceWeightsValueDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'number',
      minimum: ATTENDANCE_WEIGHT_MIN,
      maximum: ATTENDANCE_WEIGHT_MAX,
    },
    description: 'Status code → weight in [0, 1], at most 3 decimal places.',
  })
  declare readonly weights: Readonly<Record<string, number>>;
}
