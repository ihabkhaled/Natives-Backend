import { ApiProperty } from '@core/openapi';

import { NotificationCategory } from '../../model/platform.enums';
import type { ScalarPayload } from '../../model/platform.types';

/** One notification in the inbox (i18n keys + safe scalar params). */
export class NotificationViewDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ enum: NotificationCategory })
  declare readonly category: NotificationCategory;

  @ApiProperty()
  declare readonly eventType: string;

  @ApiProperty()
  declare readonly titleKey: string;

  @ApiProperty()
  declare readonly bodyKey: string;

  @ApiProperty({ type: Object })
  declare readonly params: ScalarPayload;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly readAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}

/** Paginated envelope for the notification inbox. */
export class ListNotificationsResponseDto {
  @ApiProperty({ type: [NotificationViewDto] })
  declare readonly items: readonly NotificationViewDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
