import { ApiProperty } from '@core/openapi';

import { ArticleStatus } from '../../model/article.enums';

export class ArticleResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty()
  declare readonly body: string;

  @ApiProperty({ enum: ArticleStatus })
  declare readonly status: ArticleStatus;

  @ApiProperty()
  declare readonly ownerId: string;

  @ApiProperty()
  declare readonly createdAt: string;
}
