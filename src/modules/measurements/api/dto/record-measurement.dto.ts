import { ApiProperty } from '@core/openapi';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsUUID,
  Type,
  ValidateNested,
} from '@core/validation';

import { ATTEMPTS_MAX_ITEMS } from '../../model/measurements.constants';
import { AttemptInputDto } from './attempt-input.dto';

/** Request body for recording a player's attempts for one protocol in a session. */
export class RecordMeasurementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly protocolId: string;

  @ApiProperty({ type: [AttemptInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(ATTEMPTS_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => AttemptInputDto)
  declare readonly attempts: readonly AttemptInputDto[];
}
