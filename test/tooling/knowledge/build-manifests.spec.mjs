import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildManifestData } from '../../../tools/knowledge/build-manifests.mjs';

describe('build-manifests.mjs', () => {
  let fixtureRoot;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    fixtureRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-manifests-'));

    mkdirSync(path.join(fixtureRoot, 'src', 'modules', 'widgets', 'api'), {
      recursive: true,
    });
    mkdirSync(
      path.join(fixtureRoot, 'src', 'modules', 'widgets', 'application'),
      { recursive: true },
    );
    mkdirSync(path.join(fixtureRoot, 'src', 'shared', 'constants'), {
      recursive: true,
    });
    mkdirSync(path.join(fixtureRoot, 'rules'), { recursive: true });

    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'widgets', 'index.ts'),
      "export { WidgetsModule } from './widgets.module';",
    );
    writeFileSync(
      path.join(fixtureRoot, 'src', 'modules', 'widgets', 'widgets.module.ts'),
      'export class WidgetsModule {}',
    );
    writeFileSync(
      path.join(
        fixtureRoot,
        'src',
        'modules',
        'widgets',
        'application',
        'widgets.service.ts',
      ),
      "import { WIDGET_LIMIT } from '@shared/constants';\n\nexport class WidgetsService {}",
    );
    writeFileSync(
      path.join(
        fixtureRoot,
        'src',
        'modules',
        'widgets',
        'application',
        'widgets.service.spec.ts',
      ),
      "describe('WidgetsService', () => {});",
    );
    writeFileSync(
      path.join(
        fixtureRoot,
        'src',
        'modules',
        'widgets',
        'api',
        'widgets.controller.ts',
      ),
      "import { WidgetsService } from '../application/widgets.service';\n\nexport class WidgetsController {}",
    );
    writeFileSync(
      path.join(fixtureRoot, 'src', 'shared', 'constants', 'index.ts'),
      'export const WIDGET_LIMIT = 100;',
    );
    writeFileSync(
      path.join(fixtureRoot, 'rules', 'README.md'),
      '# Rules Index\n\nIndex body.\n',
    );
    writeFileSync(
      path.join(fixtureRoot, 'rules', '01-example-rule.md'),
      '# 01 — Example Rule\n\n> Implements rule **1** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).\n\n**Related:** [README.md](./README.md)\n',
    );

    // getImportCandidates resolves relative imports via path.resolve(), which
    // uses process.cwd() — the generator's documented contract.
    process.chdir(fixtureRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('builds a repository manifest with source and spec files classified', () => {
    const { repository } = buildManifestData(fixtureRoot);

    const controller = repository.files.find(file =>
      file.path.endsWith('widgets.controller.ts'),
    );
    expect(controller.layer).toBe('controller');
    expect(controller.module).toBe('widgets');
    expect(controller.symbols).toEqual([
      { kind: 'class', name: 'WidgetsController' },
    ]);

    const spec = repository.files.find(file =>
      file.path.endsWith('widgets.service.spec.ts'),
    );
    expect(spec.kind).toBe('spec');
    expect(spec.hasSpec).toBeNull();

    const service = repository.files.find(
      file =>
        file.path.endsWith('widgets.service.ts') && file.kind === 'source',
    );
    expect(service.hasSpec).toBe(true);
    expect(service.specPath).toBe(
      'src/modules/widgets/application/widgets.service.spec.ts',
    );
  });

  it('computes a stable treeHash from file hashes', () => {
    const first = buildManifestData(fixtureRoot);
    const second = buildManifestData(fixtureRoot);
    expect(first.repository.treeHash).toBe(second.repository.treeHash);
  });

  it('groups module files into modules.json with layer buckets', () => {
    const { modules } = buildManifestData(fixtureRoot);

    expect(modules.modules).toHaveLength(1);
    const widgets = modules.modules[0];
    expect(widgets.name).toBe('widgets');
    expect(widgets.fileCount).toBe(4); // index + module + controller + service (spec excluded)
    expect(widgets.specCount).toBe(1);
    expect(widgets.publicSurface).toBe('src/modules/widgets/index.ts');
    expect(widgets.layers.controller).toEqual([
      'src/modules/widgets/api/widgets.controller.ts',
    ]);
  });

  it('includes cross-cutting roots that actually have files', () => {
    const { modules } = buildManifestData(fixtureRoot);
    const shared = modules.crossCutting.find(entry => entry.name === 'shared');
    expect(shared.submodules).toEqual(['constants']);
    // core/bootstrap have no files in this fixture — must not appear.
    expect(modules.crossCutting.some(entry => entry.name === 'core')).toBe(
      false,
    );
  });

  it('resolves both relative and @shared alias imports into dependency-graph.json', () => {
    const { dependencyGraph } = buildManifestData(fixtureRoot);

    const relativeEdge = dependencyGraph.edges.find(
      edge =>
        edge.from.endsWith('widgets.controller.ts') &&
        edge.to.endsWith('widgets.service.ts'),
    );
    expect(relativeEdge).toBeDefined();
    expect(relativeEdge.type).toBe('internal');

    const aliasEdge = dependencyGraph.edges.find(
      edge =>
        edge.from.endsWith('widgets.service.ts') && edge.to.includes('shared'),
    );
    expect(aliasEdge).toBeDefined();
    expect(aliasEdge.type).toBe('cross-cutting');
  });

  it('parses documents.json from the doc roots, skipping roots that do not exist in the fixture', () => {
    const { documents } = buildManifestData(fixtureRoot);

    expect(documents.documents.map(doc => doc.path)).toEqual([
      'rules/01-example-rule.md',
      'rules/README.md',
    ]);
    const rule = documents.documents.find(
      doc => doc.path === 'rules/01-example-rule.md',
    );
    expect(rule.ruleNumber).toBe(1);
    expect(rule.implementsRule).toEqual([1]);
    expect(rule.relatedPaths).toEqual(['./README.md']);
  });
});
