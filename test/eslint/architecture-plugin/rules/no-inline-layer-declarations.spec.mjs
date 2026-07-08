import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import rule from '../../../../eslint/architecture-plugin/rules/no-inline-layer-declarations.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: parser,
  },
});

ruleTester.run('architecture/no-inline-layer-declarations', rule, {
  valid: [
    {
      name: 'service file contains only the class and imports',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        import { Injectable } from '@nestjs/common';
        import { ExampleRepository } from '../infrastructure/example.repository';

        @Injectable()
        export class ExampleService {
          constructor(private readonly repository: ExampleRepository) {}

          async find(id: string): Promise<unknown> {
            return this.repository.findById(id);
          }
        }
      `,
    },
    {
      name: 'allowed LOG_PREFIX const is permitted',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        const LOG_PREFIX = 'ExampleService';

        export class ExampleService {
          label(): string {
            return LOG_PREFIX;
          }
        }
      `,
    },
    {
      name: 'mapper file with a single function is allowed (not a class layer)',
      filename: 'src/modules/example/lib/example.mapper.ts',
      code: `
        import type { Example } from '../model/example.types';

        export function toExampleResponse(example: Example): unknown {
          return { id: example.id };
        }
      `,
    },
    {
      name: 'constants file declares values freely',
      filename: 'src/modules/example/model/example.constants.ts',
      code: `
        export const EXAMPLE_LIMIT = 100;
        export const EXAMPLE_STATUS = 'active';
      `,
    },
    {
      name: 'types file declares interfaces freely',
      filename: 'src/modules/example/model/example.types.ts',
      code: `
        export interface Example {
          readonly id: string;
        }
        export type ExampleInput = Omit<Example, 'id'>;
      `,
    },
    {
      name: 'enum file declares enums freely',
      filename: 'src/shared/enums/example.enum.ts',
      code: `
        export enum ExampleStatus {
          Active = 'active',
          Inactive = 'inactive',
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'module-level const in service',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        const DEFAULT_LIMIT = 20;

        export class ExampleService {}
      `,
      errors: [{ messageId: 'noInlineConst' }],
    },
    {
      name: 'module-level enum in service',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        enum ExampleStatus {
          Active = 'active',
        }

        export class ExampleService {}
      `,
      errors: [{ messageId: 'noInlineEnum' }],
    },
    {
      name: 'module-level interface in service',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        interface ExampleResponse {
          id: string;
        }

        export class ExampleService {}
      `,
      errors: [{ messageId: 'noInlineInterface' }],
    },
    {
      name: 'module-level type alias in service',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        type ExampleInput = { title: string };

        export class ExampleService {}
      `,
      errors: [{ messageId: 'noInlineTypeAlias' }],
    },
    {
      name: 'module-level helper function in service',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        function helper(): string {
          return 'helper';
        }

        export class ExampleService {}
      `,
      errors: [{ messageId: 'noInlineFunction' }],
    },
    {
      name: 'module-level const in repository',
      filename: 'src/modules/example/infrastructure/example.repository.ts',
      code: `
        const MAX_LIMIT = 100;

        export class ExampleRepository {}
      `,
      errors: [{ messageId: 'noInlineConst' }],
    },
    {
      name: 'module-level const in adapter',
      filename: 'src/modules/example/adapters/email.adapter.ts',
      code: `
        const RETRY_COUNT = 3;

        export class EmailAdapter {}
      `,
      errors: [{ messageId: 'noInlineConst' }],
    },
    {
      name: 'multiple inline declarations report one error each',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        const LIMIT = 10;
        const OFFSET = 0;

        export class ExampleService {}
      `,
      errors: [{ messageId: 'noInlineConst' }, { messageId: 'noInlineConst' }],
    },
  ],
});
