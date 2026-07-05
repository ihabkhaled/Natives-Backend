import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  ARTICLE_LIST_DEFAULT_LIMIT,
  ARTICLE_LIST_MAX_LIMIT,
} from '../../model/article.constants';

export class ListArticlesQueryDto {
  @ApiPropertyOptional({
    default: ARTICLE_LIST_DEFAULT_LIMIT,
    maximum: ARTICLE_LIST_MAX_LIMIT,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ARTICLE_LIST_MAX_LIMIT)
  @IsOptional()
  readonly limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  readonly offset?: number;
}
