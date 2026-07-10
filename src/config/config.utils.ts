import { NODE_ENV_VALUES, type NodeEnv } from '@shared/enums';

import {
  FLAG_FALSE,
  FLAG_TRUE,
  INVALID_BOOLEAN_CONFIG_MESSAGE,
  INVALID_NODE_ENV_MESSAGE,
  REQUIRED_CONFIG_MISSING_MESSAGE,
} from './config.constants';

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

export function parseBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (value === FLAG_TRUE) {
    return true;
  }
  if (value === FLAG_FALSE) {
    return false;
  }
  throw new Error(INVALID_BOOLEAN_CONFIG_MESSAGE);
}

export function requireConfigValue(
  value: string | undefined,
  name: string,
): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`${REQUIRED_CONFIG_MISSING_MESSAGE}: ${name}`);
  }
  return value;
}

export function parseNodeEnv(value: string): NodeEnv {
  const nodeEnv = NODE_ENV_VALUES.find(
    candidate => candidate.localeCompare(value) === 0,
  );
  if (nodeEnv === undefined) {
    throw new Error(INVALID_NODE_ENV_MESSAGE);
  }
  return nodeEnv;
}
