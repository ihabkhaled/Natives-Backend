import { ApiProperty } from '@core/openapi';
import { IsString, MaxLength, MinLength } from '@core/validation';

import {
  OPAQUE_TOKEN_MAX_LENGTH,
  OPAQUE_TOKEN_MIN_LENGTH,
} from '../../model/identity.constants';

export class LogoutDto {
  @ApiProperty({
    minLength: OPAQUE_TOKEN_MIN_LENGTH,
    maxLength: OPAQUE_TOKEN_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPAQUE_TOKEN_MIN_LENGTH)
  @MaxLength(OPAQUE_TOKEN_MAX_LENGTH)
  declare readonly refreshToken: string;
}
