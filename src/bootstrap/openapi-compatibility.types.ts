import type { OpenApiChangeKind } from './openapi-compatibility.enums';
import type { OpenApiOperation } from './openapi-document.types';

export interface OpenApiChangeReport {
  readonly kind: OpenApiChangeKind;
  readonly breaking: boolean;
  readonly reasons: readonly string[];
}

export interface OpenApiOperationEntry {
  readonly key: string;
  readonly operation: OpenApiOperation;
}
