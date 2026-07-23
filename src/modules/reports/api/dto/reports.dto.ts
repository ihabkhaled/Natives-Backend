import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
  Type,
} from '@core/validation';

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/reports.constants';
import {
  ReportFormat,
  ReportPrivacyClass,
  ReportStatus,
  ReportTemplate,
} from '../../model/reports.enums';

/**
 * The API boundary of reports (UN-701). Every DTO class name is
 * module-qualified (`Report*`) so the generated OpenAPI document can never
 * collapse two shapes into one schema name.
 */

export class ReportListQueryDto {
  @ApiPropertyOptional({ enum: ReportTemplate })
  @IsOptional()
  @IsEnum(ReportTemplate)
  readonly template?: ReportTemplate;

  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  readonly status?: ReportStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only jobs snapshotting this season.',
  })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only jobs requested by this user (the "my requests" facet).',
  })
  @IsOptional()
  @IsUUID()
  readonly requestedBy?: string;

  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: LIST_MAX_LIMIT,
    default: LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}

export class GenerateReportDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiProperty({ enum: ReportTemplate })
  @IsEnum(ReportTemplate)
  declare readonly template: ReportTemplate;

  @ApiPropertyOptional({ enum: ReportFormat })
  @IsOptional()
  @IsEnum(ReportFormat)
  readonly format?: ReportFormat;

  @ApiPropertyOptional({
    type: Object,
    description: 'String-valued report parameters, bounded and normalized.',
  })
  @IsOptional()
  @IsObject()
  readonly parameters?: Readonly<Record<string, string>>;
}

export class ReportJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly jobId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ enum: ReportTemplate })
  declare readonly template: ReportTemplate;

  @ApiProperty({ enum: ReportFormat })
  declare readonly format: ReportFormat;

  @ApiProperty({ enum: ReportPrivacyClass })
  declare readonly privacyClass: ReportPrivacyClass;

  @ApiProperty({ enum: ReportStatus })
  declare readonly status: ReportStatus;

  @ApiProperty()
  declare readonly progress: number;

  @ApiProperty()
  declare readonly retryCount: number;

  @ApiProperty()
  declare readonly calculationVersion: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly snapshotAt: Date;

  @ApiProperty({ type: String, nullable: true })
  declare readonly checksum: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly rowCount: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly failureReason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListReportJobsResponseDto {
  @ApiProperty({ type: [ReportJobResponseDto] })
  declare readonly items: readonly ReportJobResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

export class ReportDownloadResponseDto {
  @ApiProperty()
  declare readonly url: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty()
  declare readonly checksum: string;
}
