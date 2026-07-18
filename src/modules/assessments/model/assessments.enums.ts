export enum AssessmentDirection {
  HigherIsBetter = 'higher_is_better',
  LowerIsBetter = 'lower_is_better',
  TargetRange = 'target_range',
  Descriptive = 'descriptive',
}

export const ASSESSMENT_DIRECTION_VALUES: readonly AssessmentDirection[] =
  Object.values(AssessmentDirection);

export enum AssessmentStatus {
  Active = 'active',
  Archived = 'archived',
}

export const ASSESSMENT_STATUS_VALUES: readonly AssessmentStatus[] =
  Object.values(AssessmentStatus);

export enum AssessmentTemplateStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

export const ASSESSMENT_TEMPLATE_STATUS_VALUES: readonly AssessmentTemplateStatus[] =
  Object.values(AssessmentTemplateStatus);

export enum AssessmentScaleKind {
  LegacyZeroToFive = 'legacy_0_5',
  Timed = 'timed',
  Count = 'count',
  Percentage = 'percentage',
  Categorical = 'categorical',
  Text = 'text',
}

export const ASSESSMENT_SCALE_KIND_VALUES: readonly AssessmentScaleKind[] =
  Object.values(AssessmentScaleKind);

