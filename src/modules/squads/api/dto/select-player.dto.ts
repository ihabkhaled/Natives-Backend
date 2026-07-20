import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/squads.constants';
import { SelectionRole } from '../../model/squads.enums';

/**
 * Request body to select a player into a squad. A clear candidate is selected
 * directly; a candidate an eligibility signal flags is rejected here and must go
 * through the override endpoint — the signal is advisory, the decision is human.
 */
export class SelectPlayerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiPropertyOptional({ enum: SelectionRole, default: SelectionRole.Player })
  @IsOptional()
  @IsEnum(SelectionRole)
  readonly selectionRole?: SelectionRole;

  @ApiPropertyOptional({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  readonly reason?: string | null;
}
