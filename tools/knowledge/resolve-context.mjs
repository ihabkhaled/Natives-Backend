#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rankContext, WARMUP_PATHS } from './lib/rank-context.mjs';

const REAL_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const MANIFEST_NAMES = [
  'repository',
  'modules',
  'documents',
  'dependencyGraph',
];
const MANIFEST_FILES = {
  repository: 'repository.json',
  modules: 'modules.json',
  documents: 'documents.json',
  dependencyGraph: 'dependency-graph.json',
};

export function parseArgs(argv) {
  const parsed = { task: '', files: [], diff: null };
  for (const arg of argv) {
    if (arg.startsWith('--task=')) {
      parsed.task = arg.slice('--task='.length);
    } else if (arg.startsWith('--files=')) {
      parsed.files = arg
        .slice('--files='.length)
        .split(',')
        .map(file => file.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--diff=')) {
      parsed.diff = arg.slice('--diff='.length);
    }
  }
  return parsed;
}

export function loadManifests(repoRoot) {
  const manifestDir = path.join(repoRoot, '.ai', 'manifests');
  const manifests = {};
  for (const name of MANIFEST_NAMES) {
    const filePath = path.join(manifestDir, MANIFEST_FILES[name]);
    if (!existsSync(filePath)) {
      return null;
    }
    manifests[name] = JSON.parse(readFileSync(filePath, 'utf8'));
  }
  return manifests;
}

// Never throws: an invalid range or a repo with no git history degrades to
// "no diff files" rather than crashing the whole resolve.
export function resolveDiffFiles(repoRoot, range) {
  if (!range) {
    return [];
  }
  try {
    const output = execSync(`git diff --name-only ${range}`, {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function approxTokens(charCount) {
  return Math.ceil(charCount / 4);
}

function tokenEstimateFor(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return null;
  }
  return approxTokens(readFileSync(filePath, 'utf8').length);
}

// Assembles the full output the CLI writes to disk, given already-loaded
// manifests — separated from disk I/O so it stays independently testable.
export function buildContextOutput({ task, files, manifests, repoRoot }) {
  const result = rankContext({ task, files, manifests });

  const warmup = result.warmup.map(itemPath => ({
    path: itemPath,
    tokens: tokenEstimateFor(repoRoot, itemPath),
  }));
  const ranked = result.ranked.map(entry => ({
    path: entry.path,
    score: Number.isFinite(entry.score) ? entry.score : null,
    reasons: [...new Set(entry.reasons)],
    tokens: tokenEstimateFor(repoRoot, entry.path),
  }));

  return {
    task,
    seedFiles: files,
    generatedAt: new Date().toISOString(),
    warmup,
    ranked,
    modules: result.modules,
  };
}

function toMarkdown(output) {
  const lines = [
    `# Task context — ${output.task || '(no task given)'}`,
    '',
    `Generated: ${output.generatedAt}`,
    '',
    '## Warm-up (always read first)',
    '',
  ];
  for (const item of output.warmup) {
    lines.push(
      `- \`${item.path}\`${item.tokens ? ` (~${item.tokens} tokens)` : ''}`,
    );
  }
  lines.push('', '## Ranked context', '');
  if (output.ranked.length === 0) {
    lines.push('_No task or touched files given — warm-up only._');
  }
  for (const item of output.ranked) {
    const why = item.reasons[0] ?? 'matched';
    lines.push(
      `- \`${item.path}\` — ${why}${item.tokens ? ` (~${item.tokens} tokens)` : ''}`,
    );
  }
  if (output.modules.length > 0) {
    lines.push('', '## Touched modules', '');
    for (const module of output.modules) {
      lines.push(
        `- \`${module.name}\` (${module.fileCount} files, ${module.specCount} specs)`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function writeOutput(repoRoot, output) {
  const localDir = path.join(repoRoot, '.ai', 'local');
  mkdirSync(localDir, { recursive: true });
  writeFileSync(
    path.join(localDir, 'current-context.json'),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(localDir, 'current-context.md'),
    toMarkdown(output),
    'utf8',
  );
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = REAL_REPO_ROOT;
  const { task, files, diff } = parseArgs(process.argv.slice(2));
  const diffFiles = resolveDiffFiles(repoRoot, diff);
  const allFiles = [...new Set([...files, ...diffFiles])];

  const manifests = loadManifests(repoRoot);
  if (manifests === null) {
    console.error(
      'knowledge:context — no committed manifests found under .ai/manifests/. ' +
        'Run `npm run knowledge:build` first.',
    );
    process.exit(1);
  }

  const output = buildContextOutput({
    task,
    files: allFiles,
    manifests,
    repoRoot,
  });
  writeOutput(repoRoot, output);

  console.log(
    `knowledge:context — ${WARMUP_PATHS.length} warm-up + ${output.ranked.length} ranked ` +
      `→ .ai/local/current-context.{json,md}`,
  );
}
