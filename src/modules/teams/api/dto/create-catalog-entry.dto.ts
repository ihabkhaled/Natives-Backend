import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  CATALOG_KEY_MAX_LENGTH,
  CATALOG_KEY_MIN_LENGTH,
  LABEL_MAX_LENGTH,
  NAME_MIN_LENGTH,
  SORT_ORDER_MAX,
  SORT_ORDER_MIN,
} from '../../model/teams.constants';
import { CatalogName } from '../../model/teams.enums';
import type { JsonObject } from '../../model/teams.types';

export class CreateCatalogEntryDto {
  @ApiProperty({ enum: CatalogName })
  @IsEnum(CatalogName)
  declare readonly catalog: CatalogName;

  @ApiProperty({
    minLength: CATALOG_KEY_MIN_LENGTH,
    maxLength: CATALOG_KEY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(CATALOG_KEY_MIN_LENGTH)
  @MaxLength(CATALOG_KEY_MAX_LENGTH)
  declare readonly key: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: LABEL_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(LABEL_MAX_LENGTH)
  declare readonly label: string;

  @ApiPropertyOptional({ minimum: SORT_ORDER_MIN, maximum: SORT_ORDER_MAX })
  @IsOptional()
  @IsInt()
  @Min(SORT_ORDER_MIN)
  @Max(SORT_ORDER_MAX)
  declare readonly sortOrder?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  declare readonly metadata?: JsonObject;
}
