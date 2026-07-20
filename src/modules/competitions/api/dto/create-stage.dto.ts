import { ApiProperty } from '@core/openapi';
import { IsEnum, IsString, MaxLength, MinLength } from '@core/validation';

import {
  NAME_MIN_LENGTH,
  STAGE_NAME_MAX_LENGTH,
} from '../../model/competitions.constants';
import { StageFormat } from '../../model/competitions.enums';

/** Request body for appending an ordered stage to a competition. */
export class CreateStageDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: STAGE_NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(STAGE_NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiProperty({ enum: StageFormat })
  @IsEnum(StageFormat)
  declare readonly stageFormat: StageFormat;
}
