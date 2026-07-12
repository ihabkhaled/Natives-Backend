import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { GOLDEN_TASKS } from '../data/golden-tasks.mjs';
import { ROUTING_MAP } from '../data/routing-map.mjs';
import { WARMUP_PATHS } from './rank-context.mjs';

// Governance invariants the other gates cannot see: cross-file consistency of
// the agent-entrypoint mirrors, existence of every path the resolver promises,
// and the standing "no blind suppressions" claim. Each returned finding is a
// contradiction between what the corpus asserts and what is true on disk.
// Pure over an injected repoRoot so the Vitest gate can run it against the repo.

const REQUIRED_FILES = [
  'claude.md',
  'AGENTS.md',
  'codex.md',
  'cursor.md',
  '.cursorrules',
  'rules/00-non-negotiable-rules.md',
  'context/architecture-map.md',
  '.ai/BOOTSTRAP.md',
  '.ai/manifests/repository.json',
];

// The per-model family routers must stay in lockstep on the one duplicated
// invariant they all carry (rules/29). If a new model file drops it, that is
// drift the mirror-sync check catches.
const FAMILY_ROUTERS = [
  'KIMI.md',
  'GEMINI.md',
  'GLM.md',
  'QWEN.md',
  'DEEPSEEK.md',
  'MISTRAL.md',
];
const SHARED_ROUTER_MARKER = 'Simple Code Ladder';

const SRC_DIR = 'src';
const BLIND_SUPPRESSIONS = ['eslint-disable', '@ts-ignore'];

function checkRequiredFiles(repoRoot) {
  return REQUIRED_FILES.filter(
    relativePath => !existsSync(path.join(repoRoot, relativePath)),
  ).map(relativePath => `Required governance file is missing: ${relativePath}`);
}

function checkRouterSync(repoRoot) {
  const findings = [];
  for (const router of FAMILY_ROUTERS) {
    const full = path.join(repoRoot, router);
    if (!existsSync(full)) {
      findings.push(`Family router is missing: ${router}`);
    } else if (!readFileSync(full, 'utf8').includes(SHARED_ROUTER_MARKER)) {
      findings.push(
        `${router} has drifted: it no longer carries the "${SHARED_ROUTER_MARKER}" pointer every family router must share (rules/29).`,
      );
    }
  }
  return findings;
}

function checkPathsExist(repoRoot, paths, label) {
  const findings = [];
  for (const relativePath of new Set(paths)) {
    if (!existsSync(path.join(repoRoot, relativePath))) {
      findings.push(
        `${label} references a path that does not exist: ${relativePath}`,
      );
    }
  }
  return findings;
}

function collectRoutingPaths() {
  return ROUTING_MAP.flatMap(entry => [
    ...entry.rules,
    ...entry.skills,
    ...entry.reviewers,
  ]);
}

function tsFilesUnder(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        stack.push(full);
      } else if (full.endsWith('.ts')) {
        files.push(full);
      }
    }
  }
  return files;
}

function checkNoBlindSuppressions(repoRoot) {
  const srcRoot = path.join(repoRoot, SRC_DIR);
  if (!existsSync(srcRoot)) {
    return [];
  }
  const findings = [];
  for (const file of tsFilesUnder(srcRoot)) {
    const content = readFileSync(file, 'utf8');
    for (const marker of BLIND_SUPPRESSIONS) {
      if (content.includes(marker)) {
        const relative = path.relative(repoRoot, file).replaceAll('\\', '/');
        findings.push(
          `${relative} contains "${marker}" — the corpus asserts none exist (rules/00 §4-5).`,
        );
      }
    }
  }
  return findings;
}

export function runChecks(repoRoot) {
  return [
    ...checkRequiredFiles(repoRoot),
    ...checkRouterSync(repoRoot),
    ...checkPathsExist(repoRoot, WARMUP_PATHS, 'The resolver warm-up set'),
    ...checkPathsExist(repoRoot, collectRoutingPaths(), 'The routing map'),
    ...checkPathsExist(
      repoRoot,
      GOLDEN_TASKS.flatMap(task => task.mustInclude),
      'A golden task',
    ),
    ...checkNoBlindSuppressions(repoRoot),
  ];
}
