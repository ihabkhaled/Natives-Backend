import { ApiProperty } from '@core/openapi';
import { RbacRole } from '@shared/enums';

import { AssessmentTemplateStatus } from '../../model/assessments.enums';
import { CategoryWeightDto } from './category-weight.dto';
import { TemplateMetricDto } from './template-metric.dto';

/**
 * A versioned assessment template with its category weights and ordered metric
 * slots. A draft is editable; a published version is immutable (locked) and can
 * back assessment periods.
 */
export class TemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly familyId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly key: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly cohort: string | null;

  @ApiProperty({ enum: RbacRole, isArray: true })
  declare readonly evaluatorRoles: readonly RbacRole[];

  @ApiProperty()
  declare readonly scoreVersion: number;

  @ApiProperty({ enum: AssessmentTemplateStatus })
  declare readonly status: AssessmentTemplateStatus;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly publishedBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: [CategoryWeightDto] })
  declare readonly categoryWeights: readonly CategoryWeightDto[];

  @ApiProperty({ type: [TemplateMetricDto] })
  declare readonly metrics: readonly TemplateMetricDto[];
}
