import { ApiProperty } from '@core/openapi';

import { JobStatus } from '../../model/platform.enums';

/** One scheduled job's derived health, from recorded heartbeats only. */
export class JobHealthResponseDto {
  @ApiProperty({ example: 'outbox.dispatcher' })
  declare readonly jobKey: string;

  @ApiProperty({ enum: JobStatus })
  declare readonly status: JobStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly lastRunAt: Date | null;

  @ApiProperty({ description: 'Consecutive failures; reset on success' })
  declare readonly failureCount: number;
}

/** Every registered job's health. Unpaged: the registry is small and bounded. */
export class JobHealthListResponseDto {
  @ApiProperty({ type: [JobHealthResponseDto] })
  declare readonly items: readonly JobHealthResponseDto[];
}
