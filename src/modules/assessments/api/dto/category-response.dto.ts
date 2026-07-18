import { ApiProperty } from '@core/openapi';

import { AssessmentStatus } from '../../model/assessments.enums';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty()
  declare readonly key: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly description: string;

  @ApiProperty()
  declare readonly sortOrder: number;

  @ApiProperty({ enum: AssessmentStatus })
  declare readonly status: AssessmentStatus;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
