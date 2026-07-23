import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from '@core/validation';

import { UTC_INSTANT_PATTERN } from '../../model/setting-values.constants';
import { NOTE_MAX_LENGTH, NOTE_MIN_LENGTH } from '../../model/teams.constants';
import { SettingKey } from '../../model/teams.enums';
import type { JsonObject } from '../../model/teams.types';

/**
 * Runtime request body for `POST /teams/{teamId}/settings/versions`. This DTO
 * validates the SHAPE (enum key, strict-UTC instant string, mandatory reason,
 * object value); the published contract of record is the per-key discriminated
 * union in `create-setting-version-request.dto.ts` and deep value enforcement
 * is `domain/setting-value.policy.ts` (P2, D1) — its enforcement twin. The
 * contract-drift spec keeps the three aligned per key.
 */
export class CreateSettingVersionDto {
  @ApiProperty({ enum: SettingKey })
  @IsEnum(SettingKey)
  declare readonly settingKey: SettingKey;

  @ApiProperty({
    format: 'date-time',
    pattern: UTC_INSTANT_PATTERN.source,
    description:
      'Strict UTC ISO-8601 instant (must end in Z); never in the past (D5).',
  })
  @IsString()
  @Matches(UTC_INSTANT_PATTERN)
  declare readonly effectiveFrom: string;

  @ApiProperty({ type: Object })
  @IsObject()
  declare readonly value: JsonObject;

  @ApiProperty({
    minLength: NOTE_MIN_LENGTH,
    maxLength: NOTE_MAX_LENGTH,
    description: 'Mandatory change reason (D6).',
  })
  @IsString()
  @MinLength(NOTE_MIN_LENGTH)
  @MaxLength(NOTE_MAX_LENGTH)
  declare readonly note: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Optimistic guard (D8): id of the newest version the client saw for this key, null for "no versions"; omit to skip the check.',
  })
  @IsOptional()
  @IsUUID()
  declare readonly expectedHeadVersionId?: string | null;
}
