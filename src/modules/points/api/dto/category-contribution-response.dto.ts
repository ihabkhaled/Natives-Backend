import { ApiProperty } from '@core/openapi';

/** One activity category's contribution to a member's window total. */
export class CategoryContributionResponseDto {
  @ApiProperty()
  declare readonly category: string;

  @ApiProperty()
  declare readonly points: number;
}
