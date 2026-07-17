#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadManifests } from './lib/load-manifests.mjs';
import { runBenchmark } from './lib/run-benchmark.mjs';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const manifests = loadManifests(REPO_ROOT);
if (manifests === null) {
  console.error(
    'knowledge:benchmark — no committed manifests. Run `npm run knowledge:build` first.',
  );
  process.exitCode = 1;
} else {
  const results = runBenchmark({ manifests });
  for (const result of results) {
    if (result.passed) {
      console.log(`[ok]   ${result.id}`);
    } else {
      const missing = result.missing.length
        ? `missing ${result.missing.join(', ')}`
        : '';
      const lane = result.laneOk ? '' : `lane ${result.lane} != expected`;
      console.log(
        `[FAIL] ${result.id} — ${[missing, lane].filter(Boolean).join('; ')}`,
      );
    }
  }
  const passed = results.filter(result => result.passed).length;
  console.log(
    `knowledge:benchmark — ${passed}/${results.length} golden tasks routed correctly`,
  );
  process.exitCode = passed === results.length ? 0 : 1;
}
