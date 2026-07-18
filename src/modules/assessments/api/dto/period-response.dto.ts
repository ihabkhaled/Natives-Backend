import { ApiProperty } from '@core/openapi';

import { AssessmentStatus } from '../../model/assessments.enums';

export class PeriodResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly templateId: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly cohort: string | null;

  @ApiProperty({ example: '2026-01-01' })
  declare readonly startsOn: string;

  @ApiProperty({ example: '2026-06-30' })
  declare readonly endsOn: string;

  @ApiProperty({ enum: AssessmentStatus })
  declare readonly status: AssessmentStatus;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
