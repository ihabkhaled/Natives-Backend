import { ApiProperty } from '@core/openapi';

import { ActivityTypeResponseDto } from './activity-type-response.dto';

/** A bounded page of active activity-type catalog entries. */
export class ListActivityTypesResponseDto {
  @ApiProperty({ type: [ActivityTypeResponseDto] })
  declare readonly items: readonly ActivityTypeResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
