import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsByteLength,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  DEVICE_LABEL_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  OPAQUE_TOKEN_MAX_LENGTH,
  OPAQUE_TOKEN_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../model/identity.constants';

export class AcceptInvitationDto {
  @ApiProperty({
    minLength: OPAQUE_TOKEN_MIN_LENGTH,
    maxLength: OPAQUE_TOKEN_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPAQUE_TOKEN_MIN_LENGTH)
  @MaxLength(OPAQUE_TOKEN_MAX_LENGTH)
  declare readonly token: string;

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @IsByteLength(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  declare readonly password: string;

  @ApiPropertyOptional({ maxLength: DISPLAY_NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  declare readonly displayName?: string;

  @ApiPropertyOptional({ maxLength: DEVICE_LABEL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(DEVICE_LABEL_MAX_LENGTH)
  declare readonly deviceLabel?: string;
}
