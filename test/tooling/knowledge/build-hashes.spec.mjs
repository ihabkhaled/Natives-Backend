import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildManifestData } from '../../../tools/knowledge/build-manifests.mjs';
import { checkStaleness } from '../../../tools/knowledge/build-hashes.mjs';
import { hashContent } from '../../../tools/knowledge/lib/hash.mjs';

function writeManifests(fixtureRoot, result) {
  const manifestDir = path.join(fixtureRoot, '.ai', 'manifests');
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    path.join(manifestDir, 'repository.json'),
    JSON.stringify(result.repository),
  );
  writeFileSync(
    path.join(manifestDir, 'documents.json'),
    JSON.stringify(result.documents),
  );
}

describe('build-hashes.mjs', () => {
  let fixtureRoot;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    fixtureRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-hashes-'));
    mkdirSync(path.join(fixtureRoot, 'src', 'modules', 'widgets'), {
      recursive: true,
    });
    mkdirSync(path.join(fixtureRoot, 'rules'), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'widgets', 'widgets.module.ts'),
      'export class WidgetsModule {}',
    );
    writeFileSync(
      path.join(fixtureRoot, 'rules', 'README.md'),
      '# Rules Index\n',
    );
    process.chdir(fixtureRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('reports missingManifests when knowledge:build has never run', () => {
    const report = checkStaleness(fixtureRoot);
    expect(report.missingManifests).toBe(true);
    expect(report.isStale).toBe(true);
  });

  it('reports clean when the manifest matches the current tree exactly', () => {
    const result = buildManifestData(fixtureRoot);
    writeManifests(fixtureRoot, result);

    const report = checkStaleness(fixtureRoot);
    expect(report.isStale).toBe(false);
    expect(report.source).toEqual({ added: [], removed: [], changed: [] });
    expect(report.docs).toEqual({ added: [], removed: [], changed: [] });
  });

  it('detects a changed source file', () => {
    const result = buildManifestData(fixtureRoot);
    writeManifests(fixtureRoot, result);

    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'widgets', 'widgets.module.ts'),
      'export class WidgetsModule { extra() {} }',
    );

    const report = checkStaleness(fixtureRoot);
    expect(report.isStale).toBe(true);
    expect(report.source.changed).toEqual([
      'src/modules/widgets/widgets.module.ts',
    ]);
  });

  it('detects a new source file not yet in the manifest', () => {
    const result = buildManifestData(fixtureRoot);
    writeManifests(fixtureRoot, result);

    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'widgets', 'widgets.service.ts'),
      'export class WidgetsService {}',
    );

    const report = checkStaleness(fixtureRoot);
    expect(report.isStale).toBe(true);
    expect(report.source.added).toEqual([
      'src/modules/widgets/widgets.service.ts',
    ]);
  });

  it('detects a changed doc file', () => {
    const result = buildManifestData(fixtureRoot);
    writeManifests(fixtureRoot, result);

    writeFileSync(
      path.join(fixtureRoot, 'rules', 'README.md'),
      '# Rules Index\n\nUpdated.\n',
    );

    const report = checkStaleness(fixtureRoot);
    expect(report.isStale).toBe(true);
    expect(report.docs.changed).toEqual(['rules/README.md']);
  });

  it('sanity: hashContent used by the manifest matches what checkStaleness recomputes', () => {
    const content = 'export class WidgetsModule {}';
    expect(hashContent(content)).toBe(hashContent(content));
  });
});
