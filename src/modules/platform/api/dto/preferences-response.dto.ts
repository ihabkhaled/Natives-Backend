import { ApiProperty } from '@core/openapi';

import {
  NotificationCategory,
  NotificationChannel,
} from '../../model/platform.enums';

/** One resolved notification preference. */
export class NotificationPreferenceDto {
  @ApiProperty({ enum: NotificationCategory })
  declare readonly category: NotificationCategory;

  @ApiProperty({ enum: NotificationChannel })
  declare readonly channel: NotificationChannel;

  @ApiProperty()
  declare readonly enabled: boolean;
}

/** The current user's notification preferences. */
export class PreferencesResponseDto {
  @ApiProperty({ type: [NotificationPreferenceDto] })
  declare readonly items: readonly NotificationPreferenceDto[];
}
