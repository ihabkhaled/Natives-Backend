import { ApiProperty } from '@core/openapi';

import { ArticleResponseDto } from './article-response.dto';

export class ListArticlesResponseDto {
  @ApiProperty({ type: ArticleResponseDto, isArray: true })
  readonly items!: ArticleResponseDto[];

  @ApiProperty()
  readonly total!: number;

  @ApiProperty()
  readonly limit!: number;

  @ApiProperty()
  readonly offset!: number;
}
