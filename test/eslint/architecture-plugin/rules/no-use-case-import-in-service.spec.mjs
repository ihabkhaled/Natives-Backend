import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import rule from '../../../../eslint/architecture-plugin/rules/no-use-case-import-in-service.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: parser,
  },
});

ruleTester.run('architecture/no-use-case-import-in-service', rule, {
  valid: [
    {
      name: 'service imports repository and mapper',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        import { Injectable } from '@nestjs/common';
        import { ExampleRepository } from '../infrastructure/example.repository';
        import { toExampleResponse } from '../lib/example.mapper';

        @Injectable()
        export class ExampleService {
          constructor(private readonly repository: ExampleRepository) {}

          async find(id: string): Promise<unknown> {
            return toExampleResponse(await this.repository.findById(id));
          }
        }
      `,
    },
    {
      name: 'use case may import another use case or service (not covered)',
      filename: 'src/modules/example/application/publish-example.use-case.ts',
      code: `
        import { ExampleService } from './example.service';

        export class PublishExampleUseCase {
          constructor(private readonly service: ExampleService) {}
        }
      `,
    },
    {
      name: 'file without the service suffix is not checked',
      filename: 'src/modules/example/application/helper.ts',
      code: `
        import { PublishExampleUseCase } from './publish-example.use-case';

        export function delegate(useCase: PublishExampleUseCase): void {
          void useCase;
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'service imports a use case',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        import { PublishExampleUseCase } from './publish-example.use-case';

        export class ExampleService {
          constructor(private readonly useCase: PublishExampleUseCase) {}
        }
      `,
      errors: [{ messageId: 'noUseCaseImportInService' }],
    },
    {
      name: 'service imports a use case via relative path',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        import { PublishExampleUseCase } from '../application/publish-example.use-case';

        export class ExampleService {
          run(): void {
            void PublishExampleUseCase;
          }
        }
      `,
      errors: [{ messageId: 'noUseCaseImportInService' }],
    },
    {
      name: 'service imports a use case type-only',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        import type { PublishExampleUseCase } from './publish-example.use-case';

        export class ExampleService {
          constructor(private readonly useCase: PublishExampleUseCase) {}
        }
      `,
      errors: [{ messageId: 'noUseCaseImportInService' }],
    },
  ],
});
