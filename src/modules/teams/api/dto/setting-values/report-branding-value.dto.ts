import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

import {
  BRANDING_ACCENT_PATTERN,
  BRANDING_DISPLAY_NAME_MAX_LENGTH,
  BRANDING_DISPLAY_NAME_MIN_LENGTH,
  BRANDING_EMAIL_MAX_LENGTH,
  BRANDING_FOOTER_MAX_LENGTH,
  BRANDING_LOGO_KEY_MAX_LENGTH,
  BRANDING_LOGO_KEY_MIN_LENGTH,
} from '../../../model/setting-values.constants';

/**
 * OpenAPI mirror of `ReportBrandingValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). Documentation-only (P2, D1).
 */
export class ReportBrandingValueDto {
  @ApiProperty({
    minLength: BRANDING_DISPLAY_NAME_MIN_LENGTH,
    maxLength: BRANDING_DISPLAY_NAME_MAX_LENGTH,
  })
  declare readonly displayName: string;

  @ApiPropertyOptional({
    minLength: BRANDING_LOGO_KEY_MIN_LENGTH,
    maxLength: BRANDING_LOGO_KEY_MAX_LENGTH,
  })
  declare readonly logoMediaKey?: string;

  @ApiPropertyOptional({
    pattern: BRANDING_ACCENT_PATTERN.source,
    example: '#1B7F4D',
  })
  declare readonly accentColor?: string;

  @ApiPropertyOptional({ maxLength: BRANDING_FOOTER_MAX_LENGTH })
  declare readonly footerText?: string;

  @ApiPropertyOptional({
    format: 'email',
    maxLength: BRANDING_EMAIL_MAX_LENGTH,
  })
  declare readonly contactEmail?: string;
}
