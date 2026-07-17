import { ApiProperty } from '@core/openapi';
import { IsString, MaxLength, MinLength } from '@core/validation';

import {
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_TITLE_MIN_LENGTH,
} from '../../model/article.constants';

export class CreateArticleDto {
  @ApiProperty({
    minLength: ARTICLE_TITLE_MIN_LENGTH,
    maxLength: ARTICLE_TITLE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(ARTICLE_TITLE_MIN_LENGTH)
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiProperty({ maxLength: ARTICLE_BODY_MAX_LENGTH })
  @IsString()
  @MaxLength(ARTICLE_BODY_MAX_LENGTH)
  declare readonly body: string;
}
