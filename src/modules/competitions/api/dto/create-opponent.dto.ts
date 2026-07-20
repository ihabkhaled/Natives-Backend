import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, MaxLength, MinLength } from '@core/validation';

import {
  CONTACT_INFO_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  LOGO_REF_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NOTES_MAX_LENGTH,
  SHORT_NAME_MAX_LENGTH,
} from '../../model/competitions.constants';

/**
 * Request body for cataloguing an external team the team plays. Minimal contact
 * details only — never a member's protected personal data.
 */
export class CreateOpponentDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ maxLength: SHORT_NAME_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_NAME_MAX_LENGTH)
  readonly shortName?: string | null;

  @ApiPropertyOptional({ maxLength: LOGO_REF_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LOGO_REF_MAX_LENGTH)
  readonly logoRef?: string | null;

  @ApiPropertyOptional({ maxLength: CONTACT_NAME_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(CONTACT_NAME_MAX_LENGTH)
  readonly contactName?: string | null;

  @ApiPropertyOptional({ maxLength: CONTACT_INFO_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(CONTACT_INFO_MAX_LENGTH)
  readonly contactInfo?: string | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
