import { ApiProperty } from '@core/openapi';

import { MediaPurpose, MediaScanStatus } from '../../model/members.enums';

/** Media asset metadata projection — the private storage key is never exposed. */
export class MediaAssetResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ enum: MediaPurpose })
  declare readonly purpose: MediaPurpose;

  @ApiProperty()
  declare readonly contentType: string;

  @ApiProperty()
  declare readonly byteSize: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly width: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly height: number | null;

  @ApiProperty({ enum: MediaScanStatus })
  declare readonly scanStatus: MediaScanStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
