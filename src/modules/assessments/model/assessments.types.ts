import type { RbacRole } from '@shared/enums';

import type {
  AssessmentDirection,
  AssessmentScaleKind,
  AssessmentStatus,
  AssessmentTemplateStatus,
} from './assessments.enums';

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface AssessmentCategory {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly sortOrder: number;
  readonly status: AssessmentStatus;
  readonly version: number;
  readonly createdAt: Date;
}

export interface AssessmentScale {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly valueKind: AssessmentScaleKind;
  readonly unit: string | null;
  readonly minimumValue: number | null;
  readonly maximumValue: number | null;
  readonly stepValue: number | null;
  readonly categoricalOptions: readonly string[];
  readonly guidance: string;
  readonly status: AssessmentStatus;
  readonly version: number;
  readonly createdAt: Date;
}

export interface AssessmentMetric {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string | null;
  readonly categoryId: string;
  readonly scaleId: string;
  readonly key: string;
  readonly name: string;
  readonly definition: string;
  readonly direction: AssessmentDirection;
  readonly guidance: string;
  readonly applicability: readonly string[];
  readonly tags: readonly string[];
  readonly status: AssessmentStatus;
  readonly version: number;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly archivedBy: string | null;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
}

export interface CategoryWeightInput {
  readonly categoryId: string;
  readonly weightPercentage: number;
}

export interface TemplateMetricInput {
  readonly metricDefinitionId: string;
  readonly required: boolean;
  readonly sortOrder: number;
}

export interface AssessmentTemplate {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly key: string;
  readonly name: string;
  readonly cohort: string | null;
  readonly evaluatorRoles: readonly RbacRole[];
  readonly scoreVersion: number;
  readonly status: AssessmentTemplateStatus;
  readonly version: number;
  readonly recordVersion: number;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly categoryWeights: readonly CategoryWeightInput[];
  readonly metrics: readonly TemplateMetricInput[];
}

export interface AssessmentPeriod {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly templateId: string;
  readonly name: string;
  readonly cohort: string | null;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: AssessmentStatus;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
}

export interface CreateMetricCommand {
  readonly key: string;
  readonly categoryId: string;
  readonly scaleId: string;
  readonly name: string;
  readonly definition: string;
  readonly direction: AssessmentDirection;
  readonly guidance: string;
  readonly applicability: readonly string[];
  readonly tags: readonly string[];
}

export interface CreateMetricVersionCommand extends CreateMetricCommand {
  readonly expectedRecordVersion: number;
}

export interface ArchiveMetricCommand {
  readonly expectedRecordVersion: number;
}

export interface CreateTemplateCommand {
  readonly key: string;
  readonly seasonId: string | null;
  readonly name: string;
  readonly cohort: string | null;
  readonly evaluatorRoles: readonly RbacRole[];
  readonly scoreVersion: number;
  readonly categoryWeights: readonly CategoryWeightInput[];
  readonly metrics: readonly TemplateMetricInput[];
}

export interface CreateTemplateVersionCommand extends CreateTemplateCommand {
  readonly expectedRecordVersion: number;
}

export interface PublishTemplateCommand {
  readonly expectedRecordVersion: number;
}

export interface CreatePeriodCommand {
  readonly seasonId: string | null;
  readonly templateId: string;
  readonly name: string;
  readonly cohort: string | null;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface NewMetric {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly categoryId: string;
  readonly scaleId: string;
  readonly key: string;
  readonly name: string;
  readonly definition: string;
  readonly direction: AssessmentDirection;
  readonly guidance: string;
  readonly applicability: readonly string[];
  readonly tags: readonly string[];
  readonly version: number;
  readonly createdBy: string;
  readonly now: Date;
}

export interface MetricArchive {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly archivedBy: string;
  readonly now: Date;
}

export interface NewTemplate {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly key: string;
  readonly name: string;
  readonly cohort: string | null;
  readonly evaluatorRoles: readonly RbacRole[];
  readonly scoreVersion: number;
  readonly version: number;
  readonly createdBy: string;
  readonly now: Date;
}

export interface TemplatePublish {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly publishedBy: string;
  readonly now: Date;
}

export interface NewPeriod {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly templateId: string;
  readonly name: string;
  readonly cohort: string | null;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly createdBy: string;
  readonly now: Date;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export type AssessmentCategoryPage = PagedResult<AssessmentCategory>;
export type AssessmentScalePage = PagedResult<AssessmentScale>;
export type AssessmentMetricPage = PagedResult<AssessmentMetric>;
export type AssessmentTemplatePage = PagedResult<AssessmentTemplate>;
export type AssessmentPeriodPage = PagedResult<AssessmentPeriod>;

