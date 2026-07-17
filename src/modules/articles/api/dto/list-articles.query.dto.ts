import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  ARTICLE_LIST_DEFAULT_LIMIT,
  ARTICLE_LIST_DEFAULT_OFFSET,
  ARTICLE_LIST_MAX_LIMIT,
  ARTICLE_LIST_MIN_LIMIT,
} from '../../model/article.constants';

export class ListArticlesQueryDto {
  @ApiPropertyOptional({
    default: ARTICLE_LIST_DEFAULT_LIMIT,
    maximum: ARTICLE_LIST_MAX_LIMIT,
    minimum: ARTICLE_LIST_MIN_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(ARTICLE_LIST_MIN_LIMIT)
  @Max(ARTICLE_LIST_MAX_LIMIT)
  @IsOptional()
  readonly limit?: number;

  @ApiPropertyOptional({
    default: ARTICLE_LIST_DEFAULT_OFFSET,
    minimum: ARTICLE_LIST_DEFAULT_OFFSET,
  })
  @Type(() => Number)
  @IsInt()
  @Min(ARTICLE_LIST_DEFAULT_OFFSET)
  @IsOptional()
  readonly offset?: number;
}
