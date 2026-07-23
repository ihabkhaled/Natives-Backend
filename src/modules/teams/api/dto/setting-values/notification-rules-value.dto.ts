import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

import {
  LEAD_HOURS_MAX,
  LEAD_HOURS_MIN,
  QUIET_HOURS_TIME_PATTERN,
} from '../../../model/setting-values.constants';
import {
  NotificationChannel,
  NotificationEvent,
  NotificationRecipients,
} from '../../../model/setting-values.enums';

/**
 * OpenAPI mirror of `NotificationRulesValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). Documentation-only (P2, D1).
 */
export class NotificationRuleDto {
  @ApiProperty({ enum: NotificationEvent })
  declare readonly event: NotificationEvent;

  @ApiProperty()
  declare readonly enabled: boolean;

  @ApiProperty({
    enum: NotificationChannel,
    isArray: true,
    description: 'An enabled rule needs at least one channel.',
  })
  declare readonly channels: readonly NotificationChannel[];

  @ApiPropertyOptional({
    minimum: LEAD_HOURS_MIN,
    maximum: LEAD_HOURS_MAX,
    description:
      'Required for practice_reminder, forbidden for every other event.',
  })
  declare readonly leadHours?: number;

  @ApiProperty({ enum: NotificationRecipients })
  declare readonly recipients: NotificationRecipients;
}

export class QuietHoursDto {
  @ApiProperty({
    pattern: QUIET_HOURS_TIME_PATTERN.source,
    example: '22:00',
    description: 'Africa/Cairo wall time.',
  })
  declare readonly start: string;

  @ApiProperty({
    pattern: QUIET_HOURS_TIME_PATTERN.source,
    example: '07:00',
    description:
      'Africa/Cairo wall time; an overnight window (start > end) is valid.',
  })
  declare readonly end: string;
}

export class NotificationRulesValueDto {
  @ApiProperty({ type: [NotificationRuleDto] })
  declare readonly rules: readonly NotificationRuleDto[];

  @ApiPropertyOptional({ type: QuietHoursDto })
  declare readonly quietHours?: QuietHoursDto;
}
