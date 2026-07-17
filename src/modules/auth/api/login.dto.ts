import { ApiProperty } from '@core/openapi';
import {
  IsByteLength,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  AUTH_EMAIL_MAX_LENGTH,
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from '../model/auth.constants';

export class LoginDto {
  @ApiProperty({ maxLength: AUTH_EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(AUTH_EMAIL_MAX_LENGTH)
  declare readonly email: string;

  @ApiProperty({
    minLength: AUTH_PASSWORD_MIN_LENGTH,
    maxLength: AUTH_PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(AUTH_PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_PASSWORD_MAX_LENGTH)
  @IsByteLength(AUTH_PASSWORD_MIN_LENGTH, AUTH_PASSWORD_MAX_LENGTH)
  declare readonly password: string;
}
