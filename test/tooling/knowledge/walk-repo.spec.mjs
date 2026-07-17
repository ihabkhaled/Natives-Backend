import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { walkFiles } from '../../../tools/knowledge/lib/walk-repo.mjs';

describe('walk-repo.mjs', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-walk-'));
    mkdirSync(path.join(fixtureRoot, 'src', 'modules', 'articles'), {
      recursive: true,
    });
    mkdirSync(path.join(fixtureRoot, 'src', 'node_modules', 'ignored'), {
      recursive: true,
    });
    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'articles', 'b.ts'),
      'export const b = 1;',
    );
    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'articles', 'a.ts'),
      'export const a = 1;',
    );
    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'articles', 'notes.md'),
      '# notes',
    );
    writeFileSync(
      path.join(fixtureRoot, 'src', 'node_modules', 'ignored', 'z.ts'),
      'export const z = 1;',
    );
  });

  afterEach(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('returns every file path relative to repoRoot, sorted', () => {
    const files = walkFiles(path.join(fixtureRoot, 'src'), {
      repoRoot: fixtureRoot,
    });

    expect(files).toEqual([
      'src/modules/articles/a.ts',
      'src/modules/articles/b.ts',
      'src/modules/articles/notes.md',
    ]);
  });

  it('excludes node_modules directories at any depth', () => {
    const files = walkFiles(path.join(fixtureRoot, 'src'), {
      repoRoot: fixtureRoot,
    });

    expect(files.some(file => file.includes('node_modules'))).toBe(false);
  });

  it('filters by extension when provided', () => {
    const files = walkFiles(path.join(fixtureRoot, 'src'), {
      repoRoot: fixtureRoot,
      extensions: ['.ts'],
    });

    expect(files).toEqual([
      'src/modules/articles/a.ts',
      'src/modules/articles/b.ts',
    ]);
  });

  it('returns an empty array for a directory that does not exist', () => {
    const files = walkFiles(path.join(fixtureRoot, 'does-not-exist'), {
      repoRoot: fixtureRoot,
    });

    expect(files).toEqual([]);
  });

  it('throws when repoRoot is not provided', () => {
    expect(() => walkFiles(fixtureRoot, {})).toThrow(/repoRoot/);
  });
});
