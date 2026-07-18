import { ApiProperty } from '@core/openapi';

import {
  AssessmentDirection,
  AssessmentStatus,
} from '../../model/assessments.enums';

/**
 * A versioned metric definition. `teamId` is null for the audited global catalog
 * seeds and set for team-authored metrics. `version` is the immutable definition
 * version; `recordVersion` guards optimistic archive writes.
 */
export class MetricResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly familyId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly categoryId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly scaleId: string;

  @ApiProperty()
  declare readonly key: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly definition: string;

  @ApiProperty({ enum: AssessmentDirection })
  declare readonly direction: AssessmentDirection;

  @ApiProperty()
  declare readonly guidance: string;

  @ApiProperty({ type: [String] })
  declare readonly applicability: readonly string[];

  @ApiProperty({ type: [String] })
  declare readonly tags: readonly string[];

  @ApiProperty({ enum: AssessmentStatus })
  declare readonly status: AssessmentStatus;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly archivedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly archivedAt: Date | null;
}
