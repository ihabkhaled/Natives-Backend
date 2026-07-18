import { ApiProperty } from '@core/openapi';
import { IsBoolean, IsString, Matches, MaxLength } from '@core/validation';

import {
  LOCAL_TIME_PATTERN,
  TIMEZONE_MAX_LENGTH,
} from '../../model/platform.constants';

export class UpdateQuietHoursDto {
  @ApiProperty({ example: 'Africa/Cairo', maxLength: TIMEZONE_MAX_LENGTH })
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  declare readonly timezone: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(LOCAL_TIME_PATTERN)
  declare readonly startsLocal: string;

  @ApiProperty({ example: '07:00' })
  @IsString()
  @Matches(LOCAL_TIME_PATTERN)
  declare readonly endsLocal: string;

  @ApiProperty({
    description: 'Allow urgent practice cancellations during quiet hours.',
  })
  @IsBoolean()
  declare readonly urgentCancellationOverride: boolean;
}

export class QuietHoursResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly userId: string;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ example: '22:00' })
  declare readonly startsLocal: string;

  @ApiProperty({ example: '07:00' })
  declare readonly endsLocal: string;

  @ApiProperty()
  declare readonly urgentCancellationOverride: boolean;
}
