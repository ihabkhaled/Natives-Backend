import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import rule from '../../../../eslint/architecture-plugin/rules/no-restricted-layer-imports.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: parser,
  },
});

ruleTester.run('architecture/no-restricted-layer-imports', rule, {
  valid: [
    {
      name: 'controller imports service',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `import { ExampleService } from '../application/example.service';`,
      options: [
        {
          policies: [
            {
              from: ['\\.controller(?:\\.ts)?$'],
              forbid: ['\\.repository(?:\\.ts)?$', '/infrastructure/'],
              message: 'Controllers must not import repositories.',
            },
          ],
        },
      ],
    },
    {
      name: 'service imports repository',
      filename: 'src/modules/example/application/example.service.ts',
      code: `import { ExampleRepository } from '../infrastructure/example.repository';`,
      options: [
        {
          policies: [
            {
              from: ['\\.service(?:\\.ts)?$'],
              forbid: ['\\.controller(?:\\.ts)?$'],
              message: 'Services must not import controllers.',
            },
          ],
        },
      ],
    },
    {
      name: 'process.env allowed in config',
      filename: 'src/config/app.config.ts',
      code: `const port = process.env['PORT'];`,
      options: [
        {
          restrictedAccess: [
            {
              object: 'process',
              property: 'env',
              allowIn: ['/config/', '/bootstrap/'],
              message: 'process.env only in config/bootstrap.',
            },
          ],
        },
      ],
    },
  ],
  invalid: [
    {
      name: 'controller imports repository',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `import { ExampleRepository } from '../infrastructure/example.repository';`,
      options: [
        {
          policies: [
            {
              from: ['\\.controller(?:\\.ts)?$'],
              forbid: ['\\.repository(?:\\.ts)?$', '/infrastructure/'],
              message: 'Controllers must not import repositories.',
            },
          ],
        },
      ],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'service imports controller',
      filename: 'src/modules/example/application/example.service.ts',
      code: `import { ExampleController } from '../api/example.controller';`,
      options: [
        {
          policies: [
            {
              from: ['\\.service(?:\\.ts)?$'],
              forbid: ['\\.controller(?:\\.ts)?$'],
              message: 'Services must not import controllers.',
            },
          ],
        },
      ],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'process.env computed access outside allowed directories',
      filename: 'src/modules/example/application/example.service.ts',
      code: `const secret = process.env['SECRET'];`,
      options: [
        {
          restrictedAccess: [
            {
              object: 'process',
              property: 'env',
              allowIn: ['/config/', '/bootstrap/'],
              message: 'process.env only in config/bootstrap.',
            },
          ],
        },
      ],
      errors: [{ messageId: 'restrictedAccess' }],
    },
    {
      name: 'process.env destructuring outside allowed directories',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        const { env } = process;
        const secret = env['SECRET'];
      `,
      options: [
        {
          restrictedAccess: [
            {
              object: 'process',
              property: 'env',
              allowIn: ['/config/', '/bootstrap/'],
              message: 'process.env only in config/bootstrap.',
            },
          ],
        },
      ],
      errors: [{ messageId: 'restrictedAccess' }],
    },
    {
      name: 'process.env rebinding outside allowed directories',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        const env = process.env;
        const secret = env['SECRET'];
      `,
      options: [
        {
          restrictedAccess: [
            {
              object: 'process',
              property: 'env',
              allowIn: ['/config/', '/bootstrap/'],
              message: 'process.env only in config/bootstrap.',
            },
          ],
        },
      ],
      errors: [
        { messageId: 'restrictedAccess' },
        { messageId: 'restrictedAccess' },
      ],
    },
  ],
});
