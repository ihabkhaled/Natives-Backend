/**
 * Enumerations for player/team/season/cohort analytics (UN-700). Every enum
 * ships a `*_VALUES` tuple so mappers can validate a raw database string against
 * the closed set.
 */

export enum AnalyticsSubjectType {
  Player = 'player',
  Team = 'team',
  Cohort = 'cohort',
}

export const ANALYTICS_SUBJECT_TYPE_VALUES: readonly AnalyticsSubjectType[] =
  Object.values(AnalyticsSubjectType);

/**
 * The projected player and team dimensions. Every dimension is a governed read
 * model, cited by name in a chart-ready series.
 */
export enum AnalyticsDimension {
  Technical = 'technical',
  Tactical = 'tactical',
  Physical = 'physical',
  Psychological = 'psychological',
  Behavioral = 'behavioral',
  Attendance = 'attendance',
  Consistency = 'consistency',
  Offense = 'offense',
  Defense = 'defense',
  MatchInvolvement = 'match_involvement',
  Overall = 'overall',
  RosterCoverage = 'roster_coverage',
  TrainingVolume = 'training_volume',
  AssessmentCoverage = 'assessment_coverage',
  Points = 'points',
}

export const ANALYTICS_DIMENSION_VALUES: readonly AnalyticsDimension[] =
  Object.values(AnalyticsDimension);

export enum AnalyticsPeriodType {
  Daily = 'daily',
  Session = 'session',
  Monthly = 'monthly',
  Period = 'period',
  Season = 'season',
  AllTime = 'all_time',
}

export const ANALYTICS_PERIOD_TYPE_VALUES: readonly AnalyticsPeriodType[] =
  Object.values(AnalyticsPeriodType);

/** Whether a higher value is better, worse, or neither, for chart rendering. */
export enum AnalyticsDirection {
  HigherBetter = 'higher_better',
  LowerBetter = 'lower_better',
  Neutral = 'neutral',
}

export const ANALYTICS_DIRECTION_VALUES: readonly AnalyticsDirection[] =
  Object.values(AnalyticsDirection);

/** The unit a dimension is measured in, for the axis label. */
export enum AnalyticsUnit {
  Count = 'count',
  Ratio = 'ratio',
  Points = 'points',
  Score = 'score',
  Minutes = 'minutes',
}

export const ANALYTICS_UNIT_VALUES: readonly AnalyticsUnit[] =
  Object.values(AnalyticsUnit);
