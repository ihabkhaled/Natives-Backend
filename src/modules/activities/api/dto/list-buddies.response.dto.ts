import { ApiProperty } from '@core/openapi';

import { BuddyResponseDto } from './buddy-response.dto';

/** A bounded page of the member's own pending training-buddy credits. */
export class ListBuddiesResponseDto {
  @ApiProperty({ type: [BuddyResponseDto] })
  declare readonly items: readonly BuddyResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
