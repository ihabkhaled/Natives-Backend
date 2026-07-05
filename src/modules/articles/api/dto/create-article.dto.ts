import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

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
  readonly title!: string;

  @ApiProperty({ maxLength: ARTICLE_BODY_MAX_LENGTH })
  @IsString()
  @MaxLength(ARTICLE_BODY_MAX_LENGTH)
  readonly body!: string;
}
