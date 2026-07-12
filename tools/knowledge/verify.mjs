#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runChecks } from './lib/run-checks.mjs';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const findings = runChecks(REPO_ROOT);
if (findings.length === 0) {
  console.log('knowledge:verify — no contradictions found.');
  process.exitCode = 0;
} else {
  for (const finding of findings) {
    console.error(`  - ${finding}`);
  }
  console.error(
    `knowledge:verify — ${findings.length} contradiction(s) found.`,
  );
  process.exitCode = 1;
}
