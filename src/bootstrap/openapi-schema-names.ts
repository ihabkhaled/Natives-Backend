import type { OpenApiDocument } from './openapi-document.types';

const SCHEMA_REF_PREFIX = '#/components/schemas/';
const EXPORTED_CLASS_PATTERN = /^export class ([A-Za-z0-9_]+)\b/gmu;

/**
 * The names that appear more than once in `names`, in first-seen order.
 *
 * Swagger derives a schema name from the DTO CLASS name, so two classes sharing
 * a name collapse into one entry in `components.schemas`: the loser's true shape
 * silently disappears from the canonical contract and every client generated
 * from it is wrong for that type (NestJS logs "Duplicate DTO detected" and will
 * throw in its next major). This is the detector behind that guard.
 */
export function findDuplicateNames(
  names: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      duplicated.add(name);
    }
    seen.add(name);
  }
  return [...duplicated];
}

/** Every exported class name declared in a TypeScript source file. */
export function extractExportedClassNames(source: string): readonly string[] {
  const names: string[] = [];
  for (const match of source.matchAll(EXPORTED_CLASS_PATTERN)) {
    const name = match[1];
    if (name !== undefined) {
      names.push(name);
    }
  }
  return names;
}

/** Every `#/components/schemas/<name>` reference the document contains. */
export function collectSchemaReferences(
  document: OpenApiDocument,
): readonly string[] {
  const references: string[] = [];
  collectReferences(document, references);
  return [...new Set(references)];
}

function collectReferences(value: unknown, into: string[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectReferences(entry, into);
    }
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string') {
      pushReference(entry, into);
      continue;
    }
    collectReferences(entry, into);
  }
}

function pushReference(reference: string, into: string[]): void {
  if (reference.startsWith(SCHEMA_REF_PREFIX)) {
    into.push(reference.slice(SCHEMA_REF_PREFIX.length));
  }
}
