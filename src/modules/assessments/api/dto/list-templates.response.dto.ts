import { ApiProperty } from '@core/openapi';

import { TemplateResponseDto } from './template-response.dto';

export class ListTemplatesResponseDto {
  @ApiProperty({ type: [TemplateResponseDto] })
  declare readonly items: readonly TemplateResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
