import { ApiProperty } from '@core/openapi';

import { CatalogEntryResponseDto } from './catalog-entry-response.dto';

export class ListCatalogEntriesResponseDto {
  @ApiProperty({ type: [CatalogEntryResponseDto] })
  declare readonly items: readonly CatalogEntryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
