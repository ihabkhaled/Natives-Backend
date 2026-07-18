import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsByteLength,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  DEVICE_LABEL_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../model/identity.constants';

export class LoginDto {
  @ApiProperty({ maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  declare readonly email: string;

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @IsByteLength(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  declare readonly password: string;

  @ApiPropertyOptional({ maxLength: DEVICE_LABEL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(DEVICE_LABEL_MAX_LENGTH)
  declare readonly deviceLabel?: string;
}
