import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
} from '../../model/members.constants';
import { AliasSource } from '../../model/members.enums';

/** Add a normalized name alias to a member for import matching. */
export class AddAliasDto {
  @ApiProperty({ minLength: ALIAS_MIN_LENGTH, maxLength: ALIAS_MAX_LENGTH })
  @IsString()
  @MinLength(ALIAS_MIN_LENGTH)
  @MaxLength(ALIAS_MAX_LENGTH)
  declare readonly alias: string;

  @ApiPropertyOptional({ enum: AliasSource })
  @IsOptional()
  @IsEnum(AliasSource)
  declare readonly source?: AliasSource;
}
