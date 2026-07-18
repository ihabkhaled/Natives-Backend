import { ApiProperty } from '@core/openapi';

import { CategoryResponseDto } from './category-response.dto';

export class ListCategoriesResponseDto {
  @ApiProperty({ type: [CategoryResponseDto] })
  declare readonly items: readonly CategoryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
