import { ApiProperty } from '@core/openapi';
import {
  IsByteLength,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../model/identity.constants';

/**
 * Public self-signup request. The applicant chooses a password now (mirroring
 * the invitation credential pattern) so approval needs no second step from them;
 * the account still stays inert until an admin approves it.
 */
export class SignupRequestDto {
  @ApiProperty({ maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  declare readonly email: string;

  @ApiProperty({
    minLength: DISPLAY_NAME_MIN_LENGTH,
    maxLength: DISPLAY_NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(DISPLAY_NAME_MIN_LENGTH)
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  declare readonly displayName: string;

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @IsByteLength(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  declare readonly password: string;
}
