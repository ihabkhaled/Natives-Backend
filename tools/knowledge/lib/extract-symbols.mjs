import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  layer,
  moduleSuffix,
  suffixPattern,
} from '../../../eslint/architecture.config.mjs';

// Layer classification reuses the exact suffix-naming convention already
// codified in eslint/architecture.config.mjs (moduleSuffix + suffixPattern)
// instead of re-deriving layer regexes. Suffix-based layers are checked
// before folder-based ones — a file can sit in an `adapters/` folder but a
// `*.controller.ts` suffix always wins, matching how the ESLint plugin
// itself treats suffix as the stronger signal. See rules/22-reuse-before-creating.md.
const SUFFIX_LAYERS = [
  ['controller', new RegExp(layer.controller)],
  ['service', new RegExp(layer.service)],
  ['repository', new RegExp(layer.repository)],
  ['use-case', new RegExp(layer.useCase)],
  ['adapter', new RegExp(suffixPattern('adapter'))],
  ['guard', new RegExp(suffixPattern('guard'))],
  ['interceptor', new RegExp(suffixPattern('interceptor'))],
  ['pipe', new RegExp(suffixPattern('pipe'))],
  ['filter', new RegExp(suffixPattern('filter'))],
  ['handler', new RegExp(suffixPattern('handler'))],
];

// Folder-based layers. `application`/`apiDto`/`infrastructure` reuse the
// exact patterns architecture.config.mjs already exports; `domain`/`model`/
// `lib` are local additions for folders that own no ESLint layer-boundary
// rule of their own today.
const FOLDER_LAYERS = [
  ['domain', /\/domain\//],
  ['api-dto', new RegExp(layer.apiDto)],
  ['application', new RegExp(layer.application)],
  ['infrastructure', new RegExp(layer.infrastructure)],
  ['model', /\/model\//],
  ['lib', /\/lib\//],
];

export function classifyLayer(relativePath) {
  for (const [name, pattern] of SUFFIX_LAYERS) {
    if (pattern.test(relativePath)) {
      return name;
    }
  }
  for (const [name, pattern] of FOLDER_LAYERS) {
    if (pattern.test(relativePath)) {
      return name;
    }
  }
  return 'other';
}

const MODULE_ROOT_PATTERN = /^src\/modules\/([^/]+)\//;
const CORE_ROOT_PATTERN = /^src\/core\/([^/]+)\//;
const SHARED_ROOT_PATTERN = /^src\/shared\/([^/]+)\//;

// Identifies which module/cross-cutting root a source file belongs to.
// `root` is one of: modules | core | config | bootstrap | shared | app.
export function classifyModule(relativePath) {
  const moduleMatch = MODULE_ROOT_PATTERN.exec(relativePath);
  if (moduleMatch) {
    return { root: 'modules', module: moduleMatch[1] };
  }
  const coreMatch = CORE_ROOT_PATTERN.exec(relativePath);
  if (coreMatch) {
    return { root: 'core', module: coreMatch[1] };
  }
  const sharedMatch = SHARED_ROOT_PATTERN.exec(relativePath);
  if (sharedMatch) {
    return { root: 'shared', module: sharedMatch[1] };
  }
  if (relativePath.startsWith('src/config/')) {
    return { root: 'config', module: 'config' };
  }
  if (relativePath.startsWith('src/bootstrap/')) {
    return { root: 'bootstrap', module: 'bootstrap' };
  }
  return { root: 'app', module: 'app' };
}

const EXPORT_PATTERN =
  /export\s+(?:default\s+)?(class|interface|function|enum|const|type)\s+([A-Za-z_$][\w$]*)/g;

// Regex-based export extraction — deliberately not AST-based (rules/21: 115
// source files means this is sufficient; a parser dependency buys nothing
// measured). Good enough to name the symbols a doc/module card should list,
// not a type-checker.
export function extractExportedSymbols(sourceText) {
  const symbols = [];
  for (const match of sourceText.matchAll(EXPORT_PATTERN)) {
    symbols.push({ kind: match[1], name: match[2] });
  }
  return symbols;
}

function toSpecPath(relativePath) {
  return relativePath.replace(/\.ts$/, '.spec.ts');
}

// Colocated-spec detection: this repo's own convention is `foo.x.ts` next to
// `foo.x.spec.ts` — a direct fs.existsSync check, not a separate manifest.
export function classifySpec(relativePath, { repoRoot }) {
  if (relativePath.endsWith('.spec.ts')) {
    return { hasSpec: null, specPath: null };
  }
  const specPath = toSpecPath(relativePath);
  const hasSpec = existsSync(path.join(repoRoot, specPath));
  return { hasSpec, specPath: hasSpec ? specPath : null };
}

// Convenience: the full per-file record build-manifests.mjs writes into
// repository.json, given the file's relative path and source text.
export function extractFileRecord(relativePath, sourceText, { repoRoot }) {
  const { root, module } = classifyModule(relativePath);
  const { hasSpec, specPath } = classifySpec(relativePath, { repoRoot });

  return {
    path: relativePath,
    root,
    module,
    layer: classifyLayer(relativePath),
    symbols: extractExportedSymbols(sourceText),
    hasSpec,
    specPath,
  };
}

export { moduleSuffix };
