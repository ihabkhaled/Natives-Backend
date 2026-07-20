import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  DESCRIPTION_MAX_LENGTH,
  EXTERNAL_REF_MAX_LENGTH,
  GENDER_DIVISION_MAX_LENGTH,
  ISO_DATE_PATTERN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  ORGANIZER_MAX_LENGTH,
} from '../../model/competitions.constants';
import { CompetitionType } from '../../model/competitions.enums';

/**
 * Request body for creating a DRAFT competition (league, championship, tournament,
 * friendly, or custom) for a team and season. A new competition is never visible
 * until an administrator publishes it.
 */
export class CreateCompetitionDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiProperty({ enum: CompetitionType })
  @IsEnum(CompetitionType)
  declare readonly competitionType: CompetitionType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly seasonId: string;

  @ApiPropertyOptional({
    maxLength: GENDER_DIVISION_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(GENDER_DIVISION_MAX_LENGTH)
  readonly genderDivision?: string | null;

  @ApiPropertyOptional({ maxLength: ORGANIZER_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(ORGANIZER_MAX_LENGTH)
  readonly organizerName?: string | null;

  @ApiPropertyOptional({ maxLength: EXTERNAL_REF_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(EXTERNAL_REF_MAX_LENGTH)
  readonly externalRef?: string | null;

  @ApiPropertyOptional({ pattern: ISO_DATE_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  readonly startsOn?: string | null;

  @ApiPropertyOptional({ pattern: ISO_DATE_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  readonly endsOn?: string | null;

  @ApiPropertyOptional({ maxLength: DESCRIPTION_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  readonly description?: string | null;
}
