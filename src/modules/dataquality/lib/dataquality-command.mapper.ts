import type {
  AnomalyListFilter,
  AnomalyListFilterInput,
  ScanCommand,
  ScanCommandInput,
} from '../model/dataquality.types';

export function toScanCommand(input: ScanCommandInput): ScanCommand {
  return {
    rules:
      input.rules === undefined || input.rules === null
        ? null
        : [...input.rules],
  };
}

export function toAnomalyListFilter(
  input: AnomalyListFilterInput,
): AnomalyListFilter {
  return {
    ruleKey: input.ruleKey ?? null,
    severity: input.severity ?? null,
    status: input.status ?? null,
  };
}
