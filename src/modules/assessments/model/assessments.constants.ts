import type { ErrorMessageKey } from '@core/errors/error.types';

export const ASSESSMENTS_API_TAG = 'assessments';
export const ASSESSMENT_CATALOG_ROUTE = 'teams/:teamId/assessment-catalog';
export const ASSESSMENT_CATEGORIES_ROUTE = 'categories';
export const ASSESSMENT_SCALES_ROUTE = 'scales';
export const ASSESSMENT_METRICS_ROUTE = 'metrics';
export const ASSESSMENT_METRIC_VERSIONS_ROUTE = 'metrics/:metricId/versions';
export const ASSESSMENT_METRIC_ARCHIVE_ROUTE = 'metrics/:metricId/archive';
export const ASSESSMENT_TEMPLATES_ROUTE = 'templates';
export const ASSESSMENT_TEMPLATE_VERSIONS_ROUTE =
  'templates/:templateId/versions';
export const ASSESSMENT_TEMPLATE_PUBLISH_ROUTE =
  'templates/:templateId/publish';
export const ASSESSMENT_PERIODS_ROUTE = 'periods';
export const TEAM_ID_PARAM = 'teamId';
export const METRIC_ID_PARAM = 'metricId';
export const TEMPLATE_ID_PARAM = 'templateId';

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

export const KEY_MIN_LENGTH = 2;
export const KEY_MAX_LENGTH = 80;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 160;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const GUIDANCE_MAX_LENGTH = 2000;
export const COHORT_MAX_LENGTH = 120;
export const TAG_MAX_LENGTH = 60;
export const TAGS_MAX_ITEMS = 30;
export const APPLICABILITY_MAX_ITEMS = 20;
export const TEMPLATE_METRICS_MAX_ITEMS = 100;
export const TEMPLATE_CATEGORIES_MAX_ITEMS = 20;
export const EVALUATOR_ROLES_MAX_ITEMS = 10;
export const WEIGHT_TOTAL = 100;
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 100;
export const SORT_ORDER_MIN = 0;
export const SORT_ORDER_MAX = 10_000;
export const VERSION_MIN = 1;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
export const DEFINITION_KEY_PATTERN =
  /^[a-z0-9]$|^[a-z0-9][a-z0-9_]*[a-z0-9]$/u;

export const ASSESSMENT_VALIDATION_MESSAGE =
  'The assessment catalog input violates a domain rule';
export const ASSESSMENT_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.validation';
export const ASSESSMENT_SCOPE_NOT_FOUND_MESSAGE =
  'The requested assessment scope was not found';
export const ASSESSMENT_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.scopeNotFound';
export const ASSESSMENT_METRIC_NOT_FOUND_MESSAGE =
  'The assessment metric was not found';
export const ASSESSMENT_METRIC_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.metricNotFound';
export const ASSESSMENT_METRIC_IN_USE_MESSAGE =
  'The assessment metric is referenced by a template';
export const ASSESSMENT_METRIC_IN_USE_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.metricInUse';
export const ASSESSMENT_TEMPLATE_NOT_FOUND_MESSAGE =
  'The assessment template was not found';
export const ASSESSMENT_TEMPLATE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.templateNotFound';
export const ASSESSMENT_TEMPLATE_LOCKED_MESSAGE =
  'The published assessment template version is locked';
export const ASSESSMENT_TEMPLATE_LOCKED_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.templateLocked';
export const ASSESSMENT_VERSION_CONFLICT_MESSAGE =
  'The assessment record changed since the submitted version';
export const ASSESSMENT_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.versionConflict';
export const ASSESSMENT_DUPLICATE_MESSAGE =
  'An assessment catalog entry with this key already exists';
export const ASSESSMENT_DUPLICATE_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.duplicate';

export const METRIC_CREATED_ACTION = 'assessment.metric.created';
export const METRIC_VERSION_CREATED_ACTION =
  'assessment.metric.version_created';
export const METRIC_ARCHIVED_ACTION = 'assessment.metric.archived';
export const TEMPLATE_CREATED_ACTION = 'assessment.template.created';
export const TEMPLATE_VERSION_CREATED_ACTION =
  'assessment.template.version_created';
export const TEMPLATE_PUBLISHED_ACTION = 'assessment.template.published';
export const PERIOD_CREATED_ACTION = 'assessment.period.created';
export const METRIC_RESOURCE_TYPE = 'assessment_metric_definition';
export const TEMPLATE_RESOURCE_TYPE = 'assessment_template';
export const PERIOD_RESOURCE_TYPE = 'assessment_period';
export const ASSESSMENT_EVENT_VERSION = 1;
export const TEMPLATE_PUBLISHED_EVENT = 'assessment.template.published.v1';

export const CATEGORY_COLUMNS = `"id", "category_key", "name", "description",
  "sort_order", "status", "version", "created_at"`;
export const SCALE_COLUMNS = `"id", "scale_key", "name", "value_kind", "unit",
  "minimum_value", "maximum_value", "step_value", "categorical_options",
  "guidance", "status", "scale_version", "created_at"`;
export const METRIC_COLUMNS = `"id", "family_id", "team_id", "category_id",
  "scale_id", "definition_key", "name", "definition", "direction", "guidance",
  "applicability", "tags", "status", "definition_version", "record_version",
  "created_by", "archived_by", "created_at", "archived_at"`;
export const TEMPLATE_COLUMNS = `"id", "family_id", "team_id", "season_id",
  "template_key", "name", "cohort", "evaluator_roles", "score_version",
  "status", "template_version", "record_version", "published_at",
  "published_by", "created_by", "created_at"`;
export const PERIOD_COLUMNS = `"id", "team_id", "season_id", "template_id",
  "name", "cohort", to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
  to_char("ends_on", 'YYYY-MM-DD') AS "ends_on", "status", "record_version",
  "created_by", "created_at"`;
