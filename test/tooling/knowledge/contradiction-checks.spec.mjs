import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runChecks } from '../../../tools/knowledge/lib/run-checks.mjs';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

// The contradiction-check is a governance gate: it fails when the corpus
// asserts something (mirrors in sync, resolver paths exist, no blind
// suppressions) that is not true on disk.
describe('contradiction checks against the real repo', () => {
  it('reports zero contradictions', () => {
    expect(runChecks(REPO_ROOT)).toEqual([]);
  });
});

describe('contradiction checks catch injected drift', () => {
  let scratchRoot;

  beforeEach(() => {
    scratchRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-checks-'));
  });

  afterEach(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
  });

  it('flags every governance invariant when the repo is empty', () => {
    const findings = runChecks(scratchRoot);
    // Missing required files + missing family routers are all reported.
    expect(findings.some(f => f.includes('claude.md'))).toBe(true);
    expect(findings.some(f => f.includes('KIMI.md'))).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags a family router that dropped the shared marker', () => {
    // A minimal repo where every required file exists but one router drifted.
    for (const file of [
      'claude.md',
      'AGENTS.md',
      'codex.md',
      'cursor.md',
      '.cursorrules',
    ]) {
      writeFileSync(path.join(scratchRoot, file), 'Simple Code Ladder\n');
    }
    for (const router of [
      'KIMI.md',
      'GEMINI.md',
      'GLM.md',
      'QWEN.md',
      'DEEPSEEK.md',
      'MISTRAL.md',
    ]) {
      writeFileSync(path.join(scratchRoot, router), 'Simple Code Ladder\n');
    }
    // Drift KIMI.md: drop the shared marker.
    writeFileSync(path.join(scratchRoot, 'KIMI.md'), 'no marker here\n');

    const findings = runChecks(scratchRoot);
    expect(
      findings.some(f => f.includes('KIMI.md') && f.includes('drifted')),
    ).toBe(true);
  });

  it('flags a blind suppression injected into a src file', () => {
    const srcDir = path.join(scratchRoot, 'src', 'modules', 'demo');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      path.join(srcDir, 'demo.service.ts'),
      '// eslint-disable-next-line\nexport const x = 1;\n',
    );
    const findings = runChecks(scratchRoot);
    expect(
      findings.some(
        f => f.includes('demo.service.ts') && f.includes('eslint-disable'),
      ),
    ).toBe(true);
  });
});
