import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@core/openapi';

import { UTC_INSTANT_PATTERN } from '../../model/setting-values.constants';
import { NOTE_MAX_LENGTH, NOTE_MIN_LENGTH } from '../../model/teams.constants';
import { SettingKey } from '../../model/teams.enums';
import {
  AssessmentScaleValueDto,
  AttendanceStatusesValueDto,
  AttendanceWeightsValueDto,
  BadgeTiersValueDto,
  NotificationRulesValueDto,
  ReportBrandingValueDto,
  RosterLimitsValueDto,
  SessionTypesValueDto,
} from './setting-values';

/**
 * Per-key request DTOs for `POST /teams/{teamId}/settings/versions` (P2, D1).
 * These classes exist for the OpenAPI contract only: each pins `settingKey` to
 * a single-value enum so `openapi-typescript` narrows the request union on it.
 * The runtime body is still received as `CreateSettingVersionDto` (shape-level
 * validation); deep enforcement is `domain/setting-value.policy.ts` — the
 * contract-drift spec keeps the two from diverging.
 */

const EFFECTIVE_FROM_DESCRIPTION =
  'Strict UTC ISO-8601 instant (must end in Z); never in the past (D5).';
const NOTE_DESCRIPTION = 'Mandatory change reason (D6).';
const HEAD_GUARD_DESCRIPTION =
  'Optimistic guard (D8): id of the newest version the client saw for this key, null for "no versions"; omit to skip the check.';

export class CreateAttendanceStatusesSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.AttendanceStatuses] })
  declare readonly settingKey: SettingKey.AttendanceStatuses;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: AttendanceStatusesValueDto })
  declare readonly value: AttendanceStatusesValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

export class CreateSessionTypesSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.SessionTypes] })
  declare readonly settingKey: SettingKey.SessionTypes;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: SessionTypesValueDto })
  declare readonly value: SessionTypesValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

export class CreateAttendanceWeightsSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.AttendanceWeights] })
  declare readonly settingKey: SettingKey.AttendanceWeights;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: AttendanceWeightsValueDto })
  declare readonly value: AttendanceWeightsValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

export class CreateAssessmentScaleSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.AssessmentScale] })
  declare readonly settingKey: SettingKey.AssessmentScale;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: AssessmentScaleValueDto })
  declare readonly value: AssessmentScaleValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

export class CreateBadgeTiersSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.BadgeTiers] })
  declare readonly settingKey: SettingKey.BadgeTiers;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: BadgeTiersValueDto })
  declare readonly value: BadgeTiersValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

export class CreateRosterLimitsSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.RosterLimits] })
  declare readonly settingKey: SettingKey.RosterLimits;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: RosterLimitsValueDto })
  declare readonly value: RosterLimitsValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

export class CreateNotificationRulesSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.NotificationRules] })
  declare readonly settingKey: SettingKey.NotificationRules;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: NotificationRulesValueDto })
  declare readonly value: NotificationRulesValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

export class CreateReportBrandingSettingVersionDto {
  @ApiProperty({ enum: [SettingKey.ReportBranding] })
  declare readonly settingKey: SettingKey.ReportBranding;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description: EFFECTIVE_FROM_DESCRIPTION,
  })
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: ReportBrandingValueDto })
  declare readonly value: ReportBrandingValueDto;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: NOTE_DESCRIPTION,
  })
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: HEAD_GUARD_DESCRIPTION,
  })
  declare readonly expectedHeadVersionId?: string | null;
}

/** The 8 per-key request DTOs, in canonical `SettingKey` order. */
export const CREATE_SETTING_VERSION_REQUEST_DTOS = [
  CreateAttendanceStatusesSettingVersionDto,
  CreateSessionTypesSettingVersionDto,
  CreateAttendanceWeightsSettingVersionDto,
  CreateAssessmentScaleSettingVersionDto,
  CreateBadgeTiersSettingVersionDto,
  CreateRosterLimitsSettingVersionDto,
  CreateNotificationRulesSettingVersionDto,
  CreateReportBrandingSettingVersionDto,
] as const;

/**
 * `settingKey` → schema ref: the discriminator mapping of the request union.
 * `Record<SettingKey, ...>` keeps it compile-time exhaustive — adding a 9th
 * `SettingKey` without a request DTO mapping fails the build.
 */
export const CREATE_SETTING_VERSION_DISCRIMINATOR_MAPPING: Readonly<
  Record<SettingKey, string>
> = {
  [SettingKey.AttendanceStatuses]: getSchemaPath(
    CreateAttendanceStatusesSettingVersionDto,
  ),
  [SettingKey.SessionTypes]: getSchemaPath(CreateSessionTypesSettingVersionDto),
  [SettingKey.AttendanceWeights]: getSchemaPath(
    CreateAttendanceWeightsSettingVersionDto,
  ),
  [SettingKey.AssessmentScale]: getSchemaPath(
    CreateAssessmentScaleSettingVersionDto,
  ),
  [SettingKey.BadgeTiers]: getSchemaPath(CreateBadgeTiersSettingVersionDto),
  [SettingKey.RosterLimits]: getSchemaPath(CreateRosterLimitsSettingVersionDto),
  [SettingKey.NotificationRules]: getSchemaPath(
    CreateNotificationRulesSettingVersionDto,
  ),
  [SettingKey.ReportBranding]: getSchemaPath(
    CreateReportBrandingSettingVersionDto,
  ),
};

/**
 * The discriminated request body: `settingKey` is a SIBLING of `value`, so the
 * `oneOf` union is expressed on the whole body, not on the value field alone.
 */
export const CREATE_SETTING_VERSION_BODY_SCHEMA = {
  oneOf: CREATE_SETTING_VERSION_REQUEST_DTOS.map(dto => ({
    $ref: getSchemaPath(dto),
  })),
  discriminator: {
    propertyName: 'settingKey',
    mapping: CREATE_SETTING_VERSION_DISCRIMINATOR_MAPPING,
  },
} as const;
