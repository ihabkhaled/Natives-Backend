import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GOLDEN_TASKS } from '../../../tools/knowledge/data/golden-tasks.mjs';
import { loadManifests } from '../../../tools/knowledge/lib/load-manifests.mjs';
import { runBenchmark } from '../../../tools/knowledge/lib/run-benchmark.mjs';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

// The golden benchmark is a routing regression gate equal to the tests: if a
// routing-map or ranking change stops surfacing the right rules/skills for a
// realistic task, this fails. Runs against the real committed manifests.
describe('golden benchmark (routing regression gate)', () => {
  const manifests = loadManifests(REPO_ROOT);

  it('has committed manifests to run against', () => {
    expect(manifests).not.toBeNull();
  });

  it('routes every golden task correctly (mustInclude surfaced, lane matches)', () => {
    const results = runBenchmark({ manifests });
    const failures = results.filter(result => !result.passed);
    // Surface the exact failure detail in the assertion message.
    expect(
      failures.map(f => ({ id: f.id, missing: f.missing, lane: f.lane })),
    ).toEqual([]);
    expect(results).toHaveLength(GOLDEN_TASKS.length);
  });
});
