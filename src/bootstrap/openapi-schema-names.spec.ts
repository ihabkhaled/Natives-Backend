import type { OpenApiDocument } from './openapi-document.types';
import {
  collectSchemaReferences,
  extractExportedClassNames,
  findDuplicateNames,
} from './openapi-schema-names';

describe('findDuplicateNames', () => {
  it('reports nothing for a unique list', () => {
    expect(findDuplicateNames(['A', 'B', 'C'])).toEqual([]);
  });

  it('reports each repeated name exactly once', () => {
    expect(findDuplicateNames(['A', 'B', 'A', 'C', 'A', 'B'])).toEqual([
      'A',
      'B',
    ]);
  });

  it('reports nothing for an empty list', () => {
    expect(findDuplicateNames([])).toEqual([]);
  });
});

describe('extractExportedClassNames', () => {
  it('collects every exported class, ignoring non-exported ones', () => {
    const source = [
      'import { X } from "y";',
      'class Hidden {}',
      'export class FirstDto {',
      '  declare readonly id: string;',
      '}',
      'export class SecondDto extends FirstDto {}',
      'export function notAClass() {}',
    ].join('\n');

    expect(extractExportedClassNames(source)).toEqual([
      'FirstDto',
      'SecondDto',
    ]);
  });

  it('returns nothing for a file with no exported classes', () => {
    expect(extractExportedClassNames('export const A = 1;')).toEqual([]);
  });
});

describe('collectSchemaReferences', () => {
  it('collects every distinct component-schema reference, at any depth', () => {
    const document = {
      paths: {
        '/a': {
          get: {
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/AlphaDto' },
                  },
                },
              },
            },
          },
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/AlphaDto' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          AlphaDto: {
            properties: { beta: { $ref: '#/components/schemas/BetaDto' } },
          },
          BetaDto: { type: 'object' },
        },
      },
    } as unknown as OpenApiDocument;

    expect([...collectSchemaReferences(document)].sort()).toEqual([
      'AlphaDto',
      'BetaDto',
    ]);
  });

  it('ignores non-component references and non-object values', () => {
    const document = {
      paths: { '/a': { get: { $ref: '#/paths/~1b' } } },
      tags: ['a', null, 3],
    } as unknown as OpenApiDocument;

    expect(collectSchemaReferences(document)).toEqual([]);
  });
});
