import type {
  ReportListFilter,
  ReportListFilterInput,
  ReportRequest,
  ReportRequestInput,
} from '../model/reports.types';
import { defaultFormatOf, normalizeParameters } from './reports.helpers';

export function toReportRequest(input: ReportRequestInput): ReportRequest {
  return {
    seasonId: input.seasonId ?? null,
    template: input.template,
    format: input.format ?? defaultFormatOf(input.template),
    parameters: normalizeParameters(input.parameters ?? {}),
  };
}

export function toReportListFilter(
  input: ReportListFilterInput,
): ReportListFilter {
  return {
    template: input.template ?? null,
    status: input.status ?? null,
    seasonId: input.seasonId ?? null,
    requestedBy: input.requestedBy ?? null,
  };
}
