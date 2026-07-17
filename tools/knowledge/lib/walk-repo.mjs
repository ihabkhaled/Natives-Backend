import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.husky',
  '.cursor',
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

// Deterministic, sorted, synchronous file walk — the generator runs once per
// `npm run knowledge:build` invocation on a ~250-file repo, so async/parallel
// I/O buys nothing but complexity (rules/21).
function collect(absoluteDir, repoRoot, excludeDirs, results) {
  const entries = readdirSync(absoluteDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  for (const entry of entries) {
    if (excludeDirs.has(entry.name)) {
      continue;
    }
    const absoluteChild = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      collect(absoluteChild, repoRoot, excludeDirs, results);
      continue;
    }
    if (entry.isFile()) {
      results.push(toPosix(path.relative(repoRoot, absoluteChild)));
    }
  }
}

// Walks `absoluteDir` (must live under `repoRoot`) and returns every file
// path relative to `repoRoot`, POSIX-normalized and sorted. `extensions`
// filters by suffix (e.g. [".ts", ".md"]) when provided.
export function walkFiles(absoluteDir, { repoRoot, extensions } = {}) {
  if (!repoRoot) {
    throw new Error('walkFiles requires a repoRoot option');
  }
  if (!statSync(absoluteDir, { throwIfNoEntry: false })?.isDirectory()) {
    return [];
  }

  const results = [];
  collect(absoluteDir, repoRoot, DEFAULT_EXCLUDE_DIRS, results);
  results.sort();

  if (!extensions || extensions.length === 0) {
    return results;
  }
  return results.filter(file =>
    extensions.some(extension => file.endsWith(extension)),
  );
}
