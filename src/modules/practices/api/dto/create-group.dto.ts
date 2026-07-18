import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  AGENDA_NOTES_MAX_LENGTH,
  GROUP_COLOR_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  GROUP_NAME_MIN_LENGTH,
} from '../../model/agendas.constants';

/** Body for creating a participant group with an optional assigned coach. */
export class CreateGroupDto {
  @ApiProperty({
    minLength: GROUP_NAME_MIN_LENGTH,
    maxLength: GROUP_NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(GROUP_NAME_MIN_LENGTH)
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ maxLength: GROUP_COLOR_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(GROUP_COLOR_MAX_LENGTH)
  declare readonly color?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly coachMembershipId?: string;

  @ApiPropertyOptional({ maxLength: AGENDA_NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(AGENDA_NOTES_MAX_LENGTH)
  declare readonly notes?: string;
}
