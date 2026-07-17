import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import rule from '../../../../eslint/architecture-plugin/rules/controller-no-logic.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: parser,
  },
});

ruleTester.run('architecture/controller-no-logic', rule, {
  valid: [
    {
      name: 'decorated route handler delegates directly',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller, Get } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          constructor(private readonly service: ExampleService) {}

          @Get()
          list(): Promise<unknown> {
            return this.service.list();
          }
        }
      `,
    },
    {
      name: 'decorated route handler with awaited delegation',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller, Get } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          constructor(private readonly service: ExampleService) {}

          @Get(':id')
          async getById(@Param() params: { id: string }): Promise<unknown> {
            return await this.service.getById(params.id);
          }
        }
      `,
    },
    {
      name: 'private helper without decorator is allowed to have logic',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller, Get } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          @Get()
          list(): Promise<unknown> {
            return this.service.list();
          }

          private buildFilter(): unknown {
            const status = 'active';
            return { status };
          }
        }
      `,
    },
    {
      name: 'constructor is allowed',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          constructor(private readonly service: ExampleService) {}
        }
      `,
    },
    {
      name: 'getter and setter are ignored',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          get prefix(): string {
            return 'examples';
          }

          set prefix(value: string) {
            void value;
          }
        }
      `,
    },
    {
      name: 'non-decorated public method is not treated as route handler',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          helper(): unknown {
            const a = 1;
            const b = 2;
            return a + b;
          }
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'decorated route handler with multiple statements',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller, Get } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          @Get()
          list(): unknown {
            const result = this.service.list();
            return result;
          }
        }
      `,
      errors: [{ messageId: 'singleReturnOnly' }],
    },
    {
      name: 'decorated route handler builds response object',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller, Get } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          @Get()
          list(): unknown {
            return { items: this.service.list() };
          }
        }
      `,
      errors: [{ messageId: 'invalidReturn' }],
    },
    {
      name: 'decorated route handler with conditional branch',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller, Get } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          @Get(':id')
          getById(@Param('id') id: string): unknown {
            if (id) {
              return this.service.getById(id);
            }
            return null;
          }
        }
      `,
      errors: [{ messageId: 'singleReturnOnly' }],
    },
    {
      name: 'class-property arrow route handler with logic',
      filename: 'src/modules/example/api/example.controller.ts',
      code: `
        import { Controller, Get } from '@nestjs/common';

        @Controller('examples')
        export class ExampleController {
          @Get()
          list = () => {
            const result = this.service.list();
            return result;
          };
        }
      `,
      errors: [{ messageId: 'singleReturnOnly' }],
    },
  ],
});
