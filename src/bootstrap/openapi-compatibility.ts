import { serializeOpenApiValue } from './openapi-artifact';
import { OpenApiChangeKind } from './openapi-compatibility.enums';
import type {
  OpenApiChangeReport,
  OpenApiOperationEntry,
} from './openapi-compatibility.types';
import type {
  OpenApiDocument,
  OpenApiOperation,
  OpenApiPathItem,
} from './openapi-document.types';

const HTTP_METHODS = [
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace',
] as const;

const DOCUMENTATION_FIELDS = new Set([
  'deprecated',
  'description',
  'externalDocs',
  'summary',
]);

function listOperations(document: OpenApiDocument): OpenApiOperationEntry[] {
  return Object.entries(document.paths).flatMap(([path, pathItem]) =>
    listPathOperations(path, pathItem),
  );
}

function listPathOperations(
  path: string,
  pathItem: OpenApiPathItem,
): OpenApiOperationEntry[] {
  const operations = new Map<(typeof HTTP_METHODS)[number], OpenApiOperation>(
    [
      ['delete', pathItem.delete],
      ['get', pathItem.get],
      ['head', pathItem.head],
      ['options', pathItem.options],
      ['patch', pathItem.patch],
      ['post', pathItem.post],
      ['put', pathItem.put],
      ['trace', pathItem.trace],
    ].filter(
      (entry): entry is [(typeof HTTP_METHODS)[number], OpenApiOperation] =>
        entry[1] !== undefined,
    ),
  );

  return HTTP_METHODS.flatMap(method => {
    const operation = operations.get(method);
    return operation === undefined
      ? []
      : [{ key: `${method.toUpperCase()} ${path}`, operation }];
  });
}

function withoutDocumentation(
  operation: OpenApiOperation,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(operation).filter(
      ([key]) => !DOCUMENTATION_FIELDS.has(key) && key !== 'responses',
    ),
  );
}

function addOperationReasons(
  previous: OpenApiDocument,
  current: OpenApiDocument,
  breakingReasons: string[],
  additiveReasons: string[],
  deprecatedReasons: string[],
): void {
  const previousOperations = new Map(
    listOperations(previous).map(entry => [entry.key, entry.operation]),
  );
  const currentOperations = new Map(
    listOperations(current).map(entry => [entry.key, entry.operation]),
  );

  for (const [key, operation] of previousOperations) {
    const nextOperation = currentOperations.get(key);
    if (nextOperation === undefined) {
      breakingReasons.push(`Removed operation: ${key}`);
    } else {
      compareOperation(
        key,
        operation,
        nextOperation,
        breakingReasons,
        additiveReasons,
        deprecatedReasons,
      );
    }
  }
  for (const key of currentOperations.keys()) {
    if (!previousOperations.has(key)) {
      additiveReasons.push(`Added operation: ${key}`);
    }
  }
}

function compareOperation(
  key: string,
  previous: OpenApiOperation,
  current: OpenApiOperation,
  breakingReasons: string[],
  additiveReasons: string[],
  deprecatedReasons: string[],
): void {
  if (previous.deprecated !== true && current.deprecated === true) {
    deprecatedReasons.push(`Deprecated operation: ${key}`);
  }
  if (
    serializeOpenApiValue(withoutDocumentation(previous)) !==
    serializeOpenApiValue(withoutDocumentation(current))
  ) {
    breakingReasons.push(`Changed existing operation: ${key}`);
  }
  compareResponses(
    key,
    previous.responses,
    current.responses,
    breakingReasons,
    additiveReasons,
  );
}

function compareResponses(
  operationKey: string,
  previousResponses: Readonly<Record<string, unknown>>,
  currentResponses: Readonly<Record<string, unknown>>,
  breakingReasons: string[],
  additiveReasons: string[],
): void {
  const previousResponseMap = new Map(Object.entries(previousResponses));
  const currentResponseMap = new Map(Object.entries(currentResponses));

  for (const [status, response] of previousResponseMap) {
    const nextResponse = currentResponseMap.get(status);
    if (nextResponse === undefined) {
      breakingReasons.push(
        `Removed response ${status} from operation: ${operationKey}`,
      );
    } else if (
      serializeOpenApiValue(response) !== serializeOpenApiValue(nextResponse)
    ) {
      breakingReasons.push(
        `Changed response ${status} on operation: ${operationKey}`,
      );
    }
  }
  for (const status of currentResponseMap.keys()) {
    if (!previousResponseMap.has(status)) {
      additiveReasons.push(
        `Added response ${status} to operation: ${operationKey}`,
      );
    }
  }
}

function addSchemaReasons(
  previous: OpenApiDocument,
  current: OpenApiDocument,
  breakingReasons: string[],
  additiveReasons: string[],
): void {
  const previousSchemas = previous.components?.schemas ?? {};
  const currentSchemas = current.components?.schemas ?? {};
  const previousSchemaMap = new Map(Object.entries(previousSchemas));
  const currentSchemaMap = new Map(Object.entries(currentSchemas));

  for (const [name, schema] of previousSchemaMap) {
    const nextSchema = currentSchemaMap.get(name);
    if (nextSchema === undefined) {
      breakingReasons.push(`Removed schema: ${name}`);
    } else if (
      serializeOpenApiValue(schema) !== serializeOpenApiValue(nextSchema)
    ) {
      breakingReasons.push(`Changed existing schema: ${name}`);
    }
  }
  for (const name of currentSchemaMap.keys()) {
    if (!previousSchemaMap.has(name)) {
      additiveReasons.push(`Added schema: ${name}`);
    }
  }
}

function resolveChangeKind(
  breakingReasons: readonly string[],
  deprecatedReasons: readonly string[],
  additiveReasons: readonly string[],
): OpenApiChangeKind {
  if (breakingReasons.length > 0) {
    return OpenApiChangeKind.Breaking;
  }
  if (deprecatedReasons.length > 0) {
    return OpenApiChangeKind.Deprecated;
  }
  if (additiveReasons.length > 0) {
    return OpenApiChangeKind.Additive;
  }
  return OpenApiChangeKind.Behavioral;
}

export function classifyOpenApiChange(
  previous: OpenApiDocument,
  current: OpenApiDocument,
): OpenApiChangeReport {
  if (serializeOpenApiValue(previous) === serializeOpenApiValue(current)) {
    return {
      kind: OpenApiChangeKind.Unchanged,
      breaking: false,
      reasons: [],
    };
  }

  const breakingReasons: string[] = [];
  const additiveReasons: string[] = [];
  const deprecatedReasons: string[] = [];
  addOperationReasons(
    previous,
    current,
    breakingReasons,
    additiveReasons,
    deprecatedReasons,
  );
  addSchemaReasons(previous, current, breakingReasons, additiveReasons);
  const kind = resolveChangeKind(
    breakingReasons,
    deprecatedReasons,
    additiveReasons,
  );

  return {
    kind,
    breaking: kind === OpenApiChangeKind.Breaking,
    reasons: [...breakingReasons, ...deprecatedReasons, ...additiveReasons],
  };
}
