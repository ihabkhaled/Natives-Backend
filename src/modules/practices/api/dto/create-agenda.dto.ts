import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, MaxLength } from '@core/validation';

import {
  AGENDA_NOTES_MAX_LENGTH,
  THEME_MAX_LENGTH,
} from '../../model/agendas.constants';

/** Body for creating (ensuring) a session's draft agenda. */
export class CreateAgendaDto {
  @ApiPropertyOptional({ maxLength: THEME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_MAX_LENGTH)
  declare readonly theme?: string;

  @ApiPropertyOptional({ maxLength: AGENDA_NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(AGENDA_NOTES_MAX_LENGTH)
  declare readonly notes?: string;
}
