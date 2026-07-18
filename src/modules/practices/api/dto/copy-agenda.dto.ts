import { ApiProperty } from '@core/openapi';
import { IsUUID } from '@core/validation';

/** Body for copying a plan from a source session's agenda into this session. */
export class CopyAgendaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly sourceSessionId: string;
}
