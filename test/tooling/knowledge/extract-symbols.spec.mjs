import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  classifyLayer,
  classifyModule,
  classifySpec,
  extractExportedSymbols,
  extractFileRecord,
} from '../../../tools/knowledge/lib/extract-symbols.mjs';

describe('extract-symbols.mjs', () => {
  describe('classifyLayer', () => {
    it.each([
      ['src/modules/articles/api/articles.controller.ts', 'controller'],
      ['src/modules/articles/application/articles.service.ts', 'service'],
      [
        'src/modules/articles/infrastructure/article.repository.ts',
        'repository',
      ],
      ['src/modules/example/application/publish.use-case.ts', 'use-case'],
      ['src/modules/example/adapters/vendor.adapter.ts', 'adapter'],
      ['src/modules/auth/jwt-auth.guard.ts', 'guard'],
      ['src/modules/articles/domain/article.entity.ts', 'domain'],
      ['src/modules/articles/api/dto/create-article.dto.ts', 'api-dto'],
      ['src/modules/articles/model/article.constants.ts', 'model'],
      ['src/modules/articles/lib/article.mappers.ts', 'lib'],
      ['src/modules/articles/articles.module.ts', 'other'],
    ])('classifies %s as %s', (filePath, expectedLayer) => {
      expect(classifyLayer(filePath)).toBe(expectedLayer);
    });

    it('prefers the suffix layer over the folder layer when both match', () => {
      // A controller nested under an adapters/ folder is still a controller —
      // suffix is checked before folder (see the comment in the source file).
      expect(
        classifyLayer('src/modules/example/adapters/example.controller.ts'),
      ).toBe('controller');
    });
  });

  describe('classifyModule', () => {
    it.each([
      [
        'src/modules/articles/api/articles.controller.ts',
        { root: 'modules', module: 'articles' },
      ],
      [
        'src/core/logger/app-logger.service.ts',
        { root: 'core', module: 'logger' },
      ],
      [
        'src/shared/enums/node-env.enum.ts',
        { root: 'shared', module: 'enums' },
      ],
      ['src/config/app.config.ts', { root: 'config', module: 'config' }],
      [
        'src/bootstrap/create-app.ts',
        { root: 'bootstrap', module: 'bootstrap' },
      ],
      ['src/main.ts', { root: 'app', module: 'app' }],
    ])('classifies %s', (filePath, expected) => {
      expect(classifyModule(filePath)).toEqual(expected);
    });
  });

  describe('extractExportedSymbols', () => {
    it('extracts every export kind', () => {
      const source = `
        export class ArticlesService {}
        export interface CreateArticleInput {}
        export function toArticleResponse() {}
        export enum ArticleStatus {}
        export const ARTICLE_LIST_MAX_LIMIT = 100;
        export type ArticleId = string;
      `;
      expect(extractExportedSymbols(source)).toEqual([
        { kind: 'class', name: 'ArticlesService' },
        { kind: 'interface', name: 'CreateArticleInput' },
        { kind: 'function', name: 'toArticleResponse' },
        { kind: 'enum', name: 'ArticleStatus' },
        { kind: 'const', name: 'ARTICLE_LIST_MAX_LIMIT' },
        { kind: 'type', name: 'ArticleId' },
      ]);
    });

    it('returns an empty array for a file with no exports', () => {
      expect(extractExportedSymbols('const internal = 1;')).toEqual([]);
    });
  });

  describe('classifySpec + extractFileRecord (filesystem-backed)', () => {
    let repoRoot;

    beforeEach(() => {
      repoRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-symbols-'));
      mkdirSync(path.join(repoRoot, 'src', 'modules', 'articles', 'api'), {
        recursive: true,
      });
      writeFileSync(
        path.join(
          repoRoot,
          'src',
          'modules',
          'articles',
          'api',
          'articles.controller.ts',
        ),
        'export class ArticlesController {}',
      );
      writeFileSync(
        path.join(
          repoRoot,
          'src',
          'modules',
          'articles',
          'api',
          'articles.controller.spec.ts',
        ),
        "describe('ArticlesController', () => {});",
      );
    });

    afterEach(() => {
      rmSync(repoRoot, { recursive: true, force: true });
    });

    it('detects a colocated spec file', () => {
      const result = classifySpec(
        'src/modules/articles/api/articles.controller.ts',
        { repoRoot },
      );
      expect(result).toEqual({
        hasSpec: true,
        specPath: 'src/modules/articles/api/articles.controller.spec.ts',
      });
    });

    it('reports hasSpec: false when no spec exists', () => {
      const result = classifySpec('src/modules/articles/articles.module.ts', {
        repoRoot,
      });
      expect(result).toEqual({ hasSpec: false, specPath: null });
    });

    it('returns null hasSpec for a spec file itself', () => {
      const result = classifySpec(
        'src/modules/articles/api/articles.controller.spec.ts',
        { repoRoot },
      );
      expect(result).toEqual({ hasSpec: null, specPath: null });
    });

    it('extractFileRecord assembles the full per-file record', () => {
      const record = extractFileRecord(
        'src/modules/articles/api/articles.controller.ts',
        'export class ArticlesController {}',
        { repoRoot },
      );
      expect(record).toEqual({
        path: 'src/modules/articles/api/articles.controller.ts',
        root: 'modules',
        module: 'articles',
        layer: 'controller',
        symbols: [{ kind: 'class', name: 'ArticlesController' }],
        hasSpec: true,
        specPath: 'src/modules/articles/api/articles.controller.spec.ts',
      });
    });
  });
});
