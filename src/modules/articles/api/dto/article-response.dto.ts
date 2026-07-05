import { ApiProperty } from '@nestjs/swagger';

import { ArticleStatus } from '../../model/article.enums';

export class ArticleResponseDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly title!: string;

  @ApiProperty()
  readonly body!: string;

  @ApiProperty({ enum: ArticleStatus })
  readonly status!: ArticleStatus;

  @ApiProperty()
  readonly createdAt!: string;
}
