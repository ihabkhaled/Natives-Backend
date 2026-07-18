import { ApiProperty } from '@core/openapi';

import { CatalogName, ResourceStatus } from '../../model/teams.enums';
import type { JsonObject } from '../../model/teams.types';

export class CatalogEntryResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ enum: CatalogName })
  declare readonly catalog: CatalogName;

  @ApiProperty()
  declare readonly key: string;

  @ApiProperty()
  declare readonly label: string;

  @ApiProperty()
  declare readonly sortOrder: number;

  @ApiProperty({ type: Object })
  declare readonly metadata: JsonObject;

  @ApiProperty()
  declare readonly referenceCount: number;

  @ApiProperty({ enum: ResourceStatus })
  declare readonly status: ResourceStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly updatedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;

  @ApiProperty()
  declare readonly version: number;
}
