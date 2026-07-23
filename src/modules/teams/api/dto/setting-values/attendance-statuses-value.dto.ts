import { ApiProperty } from '@core/openapi';

import { AttendanceStatus } from '../../../../practices/model/attendance.enums';
import {
  ATTENDANCE_STATUS_ENTRIES_MAX,
  ATTENDANCE_STATUS_ENTRIES_MIN,
  SETTING_LABEL_MAX_LENGTH,
  SETTING_LABEL_MIN_LENGTH,
} from '../../../model/setting-values.constants';
import { ColorToken } from '../../../model/setting-values.enums';

/**
 * OpenAPI mirror of `AttendanceStatusesValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). Documentation-only — runtime enforcement
 * is the pure policy (P2, D1).
 */
export class AttendanceStatusEntryDto {
  @ApiProperty({ enum: AttendanceStatus })
  declare readonly code: AttendanceStatus;

  @ApiProperty({
    minLength: SETTING_LABEL_MIN_LENGTH,
    maxLength: SETTING_LABEL_MAX_LENGTH,
  })
  declare readonly labelEn: string;

  @ApiProperty({
    minLength: SETTING_LABEL_MIN_LENGTH,
    maxLength: SETTING_LABEL_MAX_LENGTH,
  })
  declare readonly labelAr: string;

  @ApiProperty({ enum: ColorToken })
  declare readonly color: ColorToken;

  @ApiProperty({ description: 'Participates in attendance math.' })
  declare readonly countsTowardMetrics: boolean;

  @ApiProperty({ description: 'Member self check-in permitted.' })
  declare readonly allowSelfCheckIn: boolean;

  @ApiProperty({ description: 'Archived-not-deleted flag.' })
  declare readonly active: boolean;
}

export class AttendanceStatusesValueDto {
  @ApiProperty({
    type: [AttendanceStatusEntryDto],
    minItems: ATTENDANCE_STATUS_ENTRIES_MIN,
    maxItems: ATTENDANCE_STATUS_ENTRIES_MAX,
    description:
      'Ordered display list; must include active present_on_time and absent poles.',
  })
  declare readonly statuses: readonly AttendanceStatusEntryDto[];
}
