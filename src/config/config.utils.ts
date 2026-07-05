export function parseCsv(value: string | undefined): readonly string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

export function parseInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}
