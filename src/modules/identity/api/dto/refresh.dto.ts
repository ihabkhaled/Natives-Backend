import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, MaxLength, MinLength } from '@core/validation';

import {
  DEVICE_LABEL_MAX_LENGTH,
  OPAQUE_TOKEN_MAX_LENGTH,
  OPAQUE_TOKEN_MIN_LENGTH,
} from '../../model/identity.constants';

export class RefreshDto {
  @ApiProperty({
    minLength: OPAQUE_TOKEN_MIN_LENGTH,
    maxLength: OPAQUE_TOKEN_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPAQUE_TOKEN_MIN_LENGTH)
  @MaxLength(OPAQUE_TOKEN_MAX_LENGTH)
  declare readonly refreshToken: string;

  @ApiPropertyOptional({ maxLength: DEVICE_LABEL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(DEVICE_LABEL_MAX_LENGTH)
  declare readonly deviceLabel?: string;
}
