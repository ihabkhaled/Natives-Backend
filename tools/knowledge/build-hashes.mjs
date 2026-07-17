#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashContent } from './lib/hash.mjs';
import { walkFiles } from './lib/walk-repo.mjs';

const REAL_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const DOC_ROOTS = ['rules', 'skills', 'context', 'memory', 'agents', 'testing'];

function loadManifest(repoRoot, filename) {
  const manifestPath = path.join(repoRoot, '.ai', 'manifests', filename);
  if (!existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function currentHashes(repoRoot, absoluteDir, extensions) {
  const files = walkFiles(absoluteDir, { repoRoot, extensions });
  const hashes = new Map();
  for (const relativePath of files) {
    const content = readFileSync(path.join(repoRoot, relativePath), 'utf8');
    hashes.set(relativePath, hashContent(content));
  }
  return hashes;
}

// Diffs a "current on-disk hashes" map against a "recorded in manifest"
// array of {path, hash} records — used identically for source files
// (repository.json) and canonical docs (documents.json).
function diffHashes(currentMap, recordedEntries) {
  const recordedMap = new Map(
    recordedEntries.map(entry => [entry.path, entry.hash]),
  );
  const added = [];
  const removed = [];
  const changed = [];

  for (const [filePath, hash] of currentMap) {
    if (!recordedMap.has(filePath)) {
      added.push(filePath);
    } else if (recordedMap.get(filePath) !== hash) {
      changed.push(filePath);
    }
  }
  for (const filePath of recordedMap.keys()) {
    if (!currentMap.has(filePath)) {
      removed.push(filePath);
    }
  }

  added.sort();
  removed.sort();
  changed.sort();
  return { added, removed, changed };
}

// Returns a staleness report for the committed manifests against the
// current working tree. Never throws for a missing manifest — callers (the
// CLI) decide how to present that as "run knowledge:build first".
export function checkStaleness(repoRoot = REAL_REPO_ROOT) {
  const repository = loadManifest(repoRoot, 'repository.json');
  const documents = loadManifest(repoRoot, 'documents.json');

  if (repository === null || documents === null) {
    return { missingManifests: true, source: null, docs: null, isStale: true };
  }

  const currentSourceHashes = currentHashes(
    repoRoot,
    path.join(repoRoot, 'src'),
    ['.ts'],
  );
  const source = diffHashes(currentSourceHashes, repository.files);

  const currentDocEntries = [];
  for (const root of DOC_ROOTS) {
    for (const [filePath, hash] of currentHashes(
      repoRoot,
      path.join(repoRoot, root),
      ['.md'],
    )) {
      currentDocEntries.push([filePath, hash]);
    }
  }
  const docs = diffHashes(new Map(currentDocEntries), documents.documents);

  const isStale =
    source.added.length > 0 ||
    source.removed.length > 0 ||
    source.changed.length > 0 ||
    docs.added.length > 0 ||
    docs.removed.length > 0 ||
    docs.changed.length > 0;

  return { missingManifests: false, source, docs, isStale };
}

function formatReport(report) {
  const lines = [];
  const describe = (label, diff) => {
    for (const filePath of diff.added) lines.push(`  + ${label} ${filePath}`);
    for (const filePath of diff.removed) lines.push(`  - ${label} ${filePath}`);
    for (const filePath of diff.changed) lines.push(`  ~ ${label} ${filePath}`);
  };
  describe('src ', report.source);
  describe('doc ', report.docs);
  return lines.join('\n');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const wantsCheck = process.argv.includes('--check');
  if (!wantsCheck) {
    console.error('Usage: node tools/knowledge/build-hashes.mjs --check');
    process.exit(1);
  }

  const report = checkStaleness();

  if (report.missingManifests) {
    console.error(
      'knowledge:check — no committed manifests found under .ai/manifests/. ' +
        'Run `npm run knowledge:build` first.',
    );
    process.exit(1);
  }

  if (report.isStale) {
    console.error('knowledge:check — manifests are stale:');
    console.error(formatReport(report));
    console.error('\nRun `npm run knowledge:build` and commit the result.');
    process.exit(1);
  }

  console.log('knowledge:check — manifests are up to date.');
}
