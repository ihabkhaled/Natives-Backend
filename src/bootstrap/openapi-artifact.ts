import { createHash } from 'node:crypto';

import type { OpenApiDocument } from './openapi-document.types';
import type { JsonPrimitive, JsonValue } from './openapi-json.types';

const SHA_256 = 'sha256';
const HEX_ENCODING = 'hex';
const INDENT_SPACES = 2;

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  );
}

function normalizeArray(values: readonly unknown[]): readonly JsonValue[] {
  return values.map(value =>
    value === undefined ? null : normalizeJsonValue(value),
  );
}

function normalizeObject(value: object): JsonValue {
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, entryValue]) => [key, normalizeJsonValue(entryValue)] as const);

  return Object.fromEntries(entries);
}

export function normalizeJsonValue(value: unknown): JsonValue {
  if (isJsonPrimitive(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return normalizeArray(value);
  }
  if (typeof value === 'object') {
    return normalizeObject(value);
  }
  throw new TypeError(`Unsupported OpenAPI JSON value: ${typeof value}`);
}

export function serializeOpenApiValue(value: unknown): string {
  return `${JSON.stringify(normalizeJsonValue(value), null, INDENT_SPACES)}\n`;
}

export function serializeOpenApiDocument(document: OpenApiDocument): string {
  return serializeOpenApiValue(document);
}

export function hashOpenApiArtifact(artifact: string): string {
  return createHash(SHA_256).update(artifact).digest(HEX_ENCODING);
}
