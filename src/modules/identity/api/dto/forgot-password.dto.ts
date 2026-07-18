import { ApiProperty } from '@core/openapi';
import { IsEmail, MaxLength } from '@core/validation';

import { EMAIL_MAX_LENGTH } from '../../model/identity.constants';

export class ForgotPasswordDto {
  @ApiProperty({ maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  declare readonly email: string;
}
