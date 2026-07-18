import { ApiProperty } from '@core/openapi';
import { IsBoolean, IsEnum } from '@core/validation';

import {
  NotificationCategory,
  NotificationChannel,
} from '../../model/platform.enums';

/** Toggle one category/channel notification preference for the current user. */
export class UpdatePreferencesDto {
  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  declare readonly category: NotificationCategory;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  declare readonly channel: NotificationChannel;

  @ApiProperty()
  @IsBoolean()
  declare readonly enabled: boolean;
}
