import { getSchemaPath } from '@core/openapi';

import { AssessmentScaleValueDto } from './assessment-scale-value.dto';
import { AttendanceStatusesValueDto } from './attendance-statuses-value.dto';
import { AttendanceWeightsValueDto } from './attendance-weights-value.dto';
import { BadgeTiersValueDto } from './badge-tiers-value.dto';
import { NotificationRulesValueDto } from './notification-rules-value.dto';
import { ReportBrandingValueDto } from './report-branding-value.dto';
import { RosterLimitsValueDto } from './roster-limits-value.dto';
import { SessionTypesValueDto } from './session-types-value.dto';

export {
  AssessmentScaleValueDto,
  AttendanceStatusesValueDto,
  AttendanceWeightsValueDto,
  BadgeTiersValueDto,
  NotificationRulesValueDto,
  ReportBrandingValueDto,
  RosterLimitsValueDto,
  SessionTypesValueDto,
};
export { ScaleBandDto } from './assessment-scale-value.dto';
export { AttendanceStatusEntryDto } from './attendance-statuses-value.dto';
export { BadgeTierDto } from './badge-tiers-value.dto';
export {
  NotificationRuleDto,
  QuietHoursDto,
} from './notification-rules-value.dto';
export { PositionLimitDto, RosterBoundDto } from './roster-limits-value.dto';
export { SessionTypeEntryDto } from './session-types-value.dto';

/** The 8 per-key value DTOs, in canonical `SettingKey` order. */
export const SETTING_VALUE_DTOS = [
  AttendanceStatusesValueDto,
  SessionTypesValueDto,
  AttendanceWeightsValueDto,
  AssessmentScaleValueDto,
  BadgeTiersValueDto,
  RosterLimitsValueDto,
  NotificationRulesValueDto,
  ReportBrandingValueDto,
] as const;

/**
 * `$ref` list for response `value` unions. The referenced schemas are
 * registered on the settings controller via `@ApiExtraModels`.
 */
export const SETTING_VALUE_SCHEMA_REFS: readonly { readonly $ref: string }[] =
  SETTING_VALUE_DTOS.map(dto => ({ $ref: getSchemaPath(dto) }));

/**
 * Inline schema for legacy stored documents that predate the typed contract
 * (P2, D4): served raw on the versions listing for the honest legacy display
 * and the replace flow, never as an effective snapshot value.
 */
export const LEGACY_SETTING_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  description:
    'Legacy stored document that predates the typed settings contract.',
} as const;
