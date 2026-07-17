import { GOLDEN_TASKS } from '../data/golden-tasks.mjs';
import { rankContext } from './rank-context.mjs';
import { mergePack } from './resolve-pack.mjs';

// Runs each golden task through the real resolver (ranking + curated pack) and
// checks that every mustInclude path is surfaced somewhere the agent will read
// (warm-up ∪ pack ∪ ranked) and that the pack lane matches. Pure: takes
// already-loaded manifests, returns a result per task. run-benchmark.mjs's
// Vitest gate fails on any miss.
export function runBenchmark({ manifests, tasks = GOLDEN_TASKS }) {
  const results = [];
  for (const task of tasks) {
    const ranked = rankContext({ task: task.task, files: [], manifests });
    const pack = mergePack(task.task);
    const surfaced = new Set([
      ...ranked.warmup,
      ...ranked.ranked.map(entry => entry.path),
    ]);
    if (pack) {
      for (const list of [pack.rules, pack.skills, pack.reviewers]) {
        for (const value of list) {
          surfaced.add(value);
        }
      }
    }
    const missing = task.mustInclude.filter(path => !surfaced.has(path));
    const lane = pack?.lane ?? null;
    const laneOk = !task.expectLane || lane === task.expectLane;
    results.push({
      id: task.id,
      missing,
      lane,
      laneOk,
      passed: missing.length === 0 && laneOk,
    });
  }
  return results;
}
