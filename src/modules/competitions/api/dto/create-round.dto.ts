import { ApiProperty } from '@core/openapi';
import { IsString, IsUUID, MaxLength, MinLength } from '@core/validation';

import {
  NAME_MIN_LENGTH,
  ROUND_NAME_MAX_LENGTH,
} from '../../model/competitions.constants';

/** Request body for appending an ordered round to a stage of a competition. */
export class CreateRoundDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly stageId: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: ROUND_NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(ROUND_NAME_MAX_LENGTH)
  declare readonly name: string;
}
