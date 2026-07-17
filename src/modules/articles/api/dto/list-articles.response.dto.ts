import { ApiProperty } from '@core/openapi';

import { ArticleResponseDto } from './article-response.dto';

export class ListArticlesResponseDto {
  @ApiProperty({ type: ArticleResponseDto, isArray: true })
  declare readonly items: ArticleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
