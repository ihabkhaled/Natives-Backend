import { ApiProperty } from '@core/openapi';

/** A short-lived signed avatar upload ticket. */
export class AvatarTicketResponseDto {
  @ApiProperty()
  declare readonly mediaId: string;

  @ApiProperty()
  declare readonly storageKey: string;

  @ApiProperty()
  declare readonly uploadUrl: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;
}

/** A signed avatar download URL, or a null URL when no clean avatar exists. */
export class AvatarAccessResponseDto {
  @ApiProperty({ type: String, nullable: true })
  declare readonly url: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly expiresAt: Date | null;
}
