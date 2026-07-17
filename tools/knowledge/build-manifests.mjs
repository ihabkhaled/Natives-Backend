#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getImportCandidates } from '../../eslint/architecture-plugin/shared/source-utils.mjs';
import { extractDocMetadata } from './lib/extract-doc-metadata.mjs';
import { extractFileRecord } from './lib/extract-symbols.mjs';
import { hashContent, hashTree } from './lib/hash.mjs';
import { walkFiles } from './lib/walk-repo.mjs';

const REAL_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

// Doc roots this generator indexes into documents.json. Kept in one place —
// add a root here, nowhere else, if a new canonical folder is introduced.
const DOC_ROOTS = ['rules', 'skills', 'context', 'memory', 'agents', 'testing'];

function readRelative(repoRoot, relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function buildRepository(repoRoot, buildTimestamp) {
  const sourceFiles = walkFiles(path.join(repoRoot, 'src'), {
    repoRoot,
    extensions: ['.ts'],
  });

  const files = sourceFiles.map(relativePath => {
    const isSpec = relativePath.endsWith('.spec.ts');
    const classificationPath = isSpec
      ? relativePath.replace(/\.spec\.ts$/, '.ts')
      : relativePath;
    const sourceText = readRelative(repoRoot, relativePath);
    const record = extractFileRecord(classificationPath, sourceText, {
      repoRoot,
    });

    return {
      ...record,
      path: relativePath,
      kind: isSpec ? 'spec' : 'source',
      hash: hashContent(sourceText),
      sizeBytes: Buffer.byteLength(sourceText, 'utf8'),
      // hasSpec/specPath are meaningless for a spec file itself.
      hasSpec: isSpec ? null : record.hasSpec,
      specPath: isSpec ? null : record.specPath,
    };
  });

  return {
    generatedAt: buildTimestamp,
    treeHash: hashTree(files.map(file => file.hash)),
    files,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

function buildModules(repository, buildTimestamp) {
  const moduleFiles = repository.files.filter(
    file => file.root === 'modules' && file.kind === 'source',
  );
  const byModule = groupBy(moduleFiles, file => file.module);

  const modules = [...byModule.entries()]
    .map(([name, files]) => {
      const layers = {};
      for (const file of files) {
        (layers[file.layer] ??= []).push(file.path);
      }
      for (const layerFiles of Object.values(layers)) {
        layerFiles.sort();
      }
      const modulePath = `src/modules/${name}`;
      return {
        name,
        path: modulePath,
        layers,
        fileCount: files.length,
        specCount: files.filter(file => file.hasSpec).length,
        publicSurface: files.some(
          file => file.path === `${modulePath}/index.ts`,
        )
          ? `${modulePath}/index.ts`
          : null,
        hasEvents: files.some(file => /\/events?\//.test(file.path)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const namedCrossCuttingRoots = ['core', 'shared'];
  const crossCutting = namedCrossCuttingRoots
    .map(root => {
      const files = repository.files.filter(
        file => file.root === root && file.kind === 'source',
      );
      const submodules = [...new Set(files.map(file => file.module))].sort();
      return { name: root, path: `src/${root}`, submodules };
    })
    .concat(
      ['config', 'bootstrap']
        .filter(root =>
          repository.files.some(
            file => file.root === root && file.kind === 'source',
          ),
        )
        .map(root => ({ name: root, path: `src/${root}`, submodules: [] })),
    )
    .filter(
      entry =>
        entry.submodules.length > 0 ||
        entry.name === 'config' ||
        entry.name === 'bootstrap',
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return { generatedAt: buildTimestamp, modules, crossCutting };
}

function buildDocuments(repoRoot, buildTimestamp, docRoots = DOC_ROOTS) {
  const documents = [];
  for (const root of docRoots) {
    const docFiles = walkFiles(path.join(repoRoot, root), {
      repoRoot,
      extensions: ['.md'],
    });
    for (const relativePath of docFiles) {
      const docText = readRelative(repoRoot, relativePath);
      documents.push({
        ...extractDocMetadata(relativePath, docText),
        hash: hashContent(docText),
      });
    }
  }
  documents.sort((a, b) => a.path.localeCompare(b.path));
  return { generatedAt: buildTimestamp, documents };
}

function classifyEdgeType(fromRecord, toRecord) {
  if (
    fromRecord.root === toRecord.root &&
    fromRecord.module === toRecord.module
  ) {
    return 'internal';
  }
  if (fromRecord.root === 'modules' && toRecord.root === 'modules') {
    return 'cross-module';
  }
  return 'cross-cutting';
}

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?[^;]*?\bfrom\s+['"]([^'"]+)['"]/g;
const RESOLUTION_SUFFIXES = ['', '.ts', '/index.ts'];

// getImportCandidates's relative-import branch calls path.resolve(), which
// resolves against process.cwd() — callers of this module must run with
// cwd = repoRoot (true for `npm run knowledge:build`, direct
// `node tools/knowledge/build-manifests.mjs` invocation, and every Vitest
// spec here via `process.chdir` in its fixture setup). Its alias/src-prefixed
// branches already return repo-relative paths, so this only needs to
// normalize the relative-import case back down.
function toRepoRelativePosix(candidate, repoRoot) {
  if (!path.isAbsolute(candidate)) {
    return candidate;
  }
  return path.relative(repoRoot, candidate).split(path.sep).join('/');
}

function resolveImportToRepoFile(
  source,
  fromRelativePath,
  filesByPath,
  repoRoot,
) {
  const candidates = getImportCandidates(source, fromRelativePath).map(
    candidate => toRepoRelativePosix(candidate, repoRoot),
  );
  for (const candidate of candidates) {
    for (const suffix of RESOLUTION_SUFFIXES) {
      const attempt = `${candidate}${suffix}`;
      if (filesByPath.has(attempt)) {
        return attempt;
      }
    }
  }
  return null;
}

function buildDependencyGraph(repository, repoRoot, buildTimestamp) {
  const filesByPath = new Map(repository.files.map(file => [file.path, file]));
  const edges = [];

  for (const file of repository.files) {
    if (file.kind !== 'source') {
      continue;
    }
    const sourceText = readRelative(repoRoot, file.path);
    for (const match of sourceText.matchAll(IMPORT_PATTERN)) {
      const importSource = match[1];
      if (
        !importSource.startsWith('.') &&
        !importSource.startsWith('@') &&
        !importSource.startsWith('src/')
      ) {
        continue; // external package — not part of the internal dependency graph
      }
      const resolved = resolveImportToRepoFile(
        importSource,
        file.path,
        filesByPath,
        repoRoot,
      );
      if (resolved === null || resolved === file.path) {
        continue;
      }
      edges.push({
        from: file.path,
        to: resolved,
        type: classifyEdgeType(file, filesByPath.get(resolved)),
      });
    }
  }

  edges.sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to));
  return { generatedAt: buildTimestamp, edges };
}

// `generatedAt` is informational (when the manifest was last built) and is
// deliberately excluded from the staleness comparison in build-hashes.mjs,
// which compares per-file/per-doc content hashes instead — those are stable
// across repeated builds of unchanged source, `generatedAt` is not, and it
// shouldn't need to be for a meaningful determinism check.
function writeManifest(outputDir, filename, data) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    path.join(outputDir, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8',
  );
}

// Pure builder: given a repoRoot, returns the 4 manifest objects without
// touching disk output. Vitest specs call this directly against a fixture
// tree; the CLI entrypoint below wraps it with real timestamps + file writes.
export function buildManifestData(repoRoot, { docRoots = DOC_ROOTS } = {}) {
  const buildTimestamp = new Date().toISOString();
  const repository = buildRepository(repoRoot, buildTimestamp);
  const modules = buildModules(repository, buildTimestamp);
  const documents = buildDocuments(repoRoot, buildTimestamp, docRoots);
  const dependencyGraph = buildDependencyGraph(
    repository,
    repoRoot,
    buildTimestamp,
  );

  return { repository, modules, documents, dependencyGraph };
}

export function buildAllManifests(repoRoot = REAL_REPO_ROOT, options = {}) {
  const outputDir = path.join(repoRoot, '.ai', 'manifests');
  const result = buildManifestData(repoRoot, options);

  writeManifest(outputDir, 'repository.json', result.repository);
  writeManifest(outputDir, 'modules.json', result.modules);
  writeManifest(outputDir, 'documents.json', result.documents);
  writeManifest(outputDir, 'dependency-graph.json', result.dependencyGraph);

  return result;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const result = buildAllManifests();
  console.log(
    `knowledge:build — ${result.repository.files.length} source files, ` +
      `${result.modules.modules.length} modules, ` +
      `${result.documents.documents.length} docs, ` +
      `${result.dependencyGraph.edges.length} dependency edges`,
  );
}
