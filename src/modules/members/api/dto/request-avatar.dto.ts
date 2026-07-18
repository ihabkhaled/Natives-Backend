import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Type,
} from '@core/validation';

import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIMENSION,
  AVATAR_MIN_DIMENSION,
  CONTENT_TYPE_MAX_LENGTH,
} from '../../model/members.constants';

/**
 * Request a signed avatar upload URL. Content type, size, and (optional)
 * dimensions are validated before an object-storage key is minted. Dimensions may
 * be omitted when the client does not know them (null-not-zero).
 */
export class RequestAvatarDto {
  @ApiProperty({ maxLength: CONTENT_TYPE_MAX_LENGTH })
  @IsString()
  @MaxLength(CONTENT_TYPE_MAX_LENGTH)
  declare readonly contentType: string;

  @ApiProperty({ minimum: 1, maximum: AVATAR_MAX_BYTES })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AVATAR_MAX_BYTES)
  declare readonly byteSize: number;

  @ApiPropertyOptional({
    minimum: AVATAR_MIN_DIMENSION,
    maximum: AVATAR_MAX_DIMENSION,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AVATAR_MIN_DIMENSION)
  @Max(AVATAR_MAX_DIMENSION)
  declare readonly width?: number;

  @ApiPropertyOptional({
    minimum: AVATAR_MIN_DIMENSION,
    maximum: AVATAR_MAX_DIMENSION,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AVATAR_MIN_DIMENSION)
  @Max(AVATAR_MAX_DIMENSION)
  declare readonly height?: number;
}
