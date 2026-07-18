import { ApiProperty } from '@core/openapi';
import { IsEnum } from '@core/validation';

import { MediaScanStatus } from '../../model/members.enums';

/** Record the malware-scan outcome for a media asset (system/staff action). */
export class RecordScanDto {
  @ApiProperty({ enum: MediaScanStatus })
  @IsEnum(MediaScanStatus)
  declare readonly outcome: MediaScanStatus;
}
