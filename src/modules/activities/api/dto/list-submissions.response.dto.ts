import { ApiProperty } from '@core/openapi';

import { SubmissionDetailResponseDto } from './submission-detail-response.dto';

/** A bounded page of the member's own submissions with buddies + evidence counts. */
export class ListSubmissionsResponseDto {
  @ApiProperty({ type: [SubmissionDetailResponseDto] })
  declare readonly items: readonly SubmissionDetailResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
