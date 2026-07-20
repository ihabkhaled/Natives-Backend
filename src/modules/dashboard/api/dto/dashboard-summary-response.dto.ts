import { ApiProperty } from '@core/openapi';

import {
  DashboardMetricUnit,
  DashboardPersona,
  DashboardPresentation,
  DashboardTone,
  DashboardWidgetKind,
  DashboardWidgetStatus,
} from '../../model/dashboard.enums';

export class DashboardMetricDto {
  @ApiProperty({ type: Number, nullable: true })
  declare readonly value: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly displayValue: string | null;

  @ApiProperty({ enum: DashboardMetricUnit, nullable: true })
  declare readonly unit: DashboardMetricUnit | null;

  @ApiProperty({ enum: DashboardTone })
  declare readonly tone: DashboardTone;
}

export class DashboardBreakdownRowDto {
  @ApiProperty()
  declare readonly key: string;

  @ApiProperty({ description: 'i18n key; raw server copy is never rendered' })
  declare readonly labelKey: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly value: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly displayValue: string | null;
}

export class DashboardTaskDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty({ description: 'i18n key; raw server copy is never rendered' })
  declare readonly labelKey: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly count: number | null;

  @ApiProperty({ enum: DashboardTone })
  declare readonly tone: DashboardTone;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly occurredAt: Date | null;
}

/**
 * One widget. `presentation` discriminates the payload: `metric` carries
 * `metric`, `breakdown` carries `rows`, `tasks` carries `tasks`. A numeric value
 * is null whenever nothing was measured — never zero.
 */
export class DashboardWidgetDto {
  @ApiProperty({ enum: DashboardWidgetKind })
  declare readonly kind: DashboardWidgetKind;

  @ApiProperty({ enum: DashboardPresentation })
  declare readonly presentation: DashboardPresentation;

  @ApiProperty({ enum: DashboardWidgetStatus })
  declare readonly status: DashboardWidgetStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Per-widget freshness instant reported by its own source',
  })
  declare readonly asOf: Date | null;

  @ApiProperty({ type: DashboardMetricDto, required: false })
  declare readonly metric?: DashboardMetricDto;

  @ApiProperty({ type: [DashboardBreakdownRowDto], required: false })
  declare readonly rows?: readonly DashboardBreakdownRowDto[];

  @ApiProperty({ type: [DashboardTaskDto], required: false })
  declare readonly tasks?: readonly DashboardTaskDto[];
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ enum: DashboardPersona })
  declare readonly persona: DashboardPersona;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly generatedAt: Date;

  @ApiProperty({ type: [DashboardWidgetDto] })
  declare readonly widgets: readonly DashboardWidgetDto[];
}
