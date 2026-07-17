import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import rule from '../../../../eslint/architecture-plugin/rules/no-dto-import-in-domain-or-use-case.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: parser,
  },
});

ruleTester.run('architecture/no-dto-import-in-domain-or-use-case', rule, {
  valid: [
    {
      name: 'domain file imports model types',
      filename: 'src/modules/example/domain/example.policy.ts',
      code: `
        import { ExampleStatus } from '../model/example.enums';
        import type { Example } from '../model/example.types';

        export function isExampleActive(example: Example): boolean {
          return example.status === ExampleStatus.Active;
        }
      `,
    },
    {
      name: 'domain file imports shared enums',
      filename: 'src/modules/example/domain/example.entity.ts',
      code: `
        import { NodeEnv } from '@shared/enums';

        export function isProduction(nodeEnv: NodeEnv): boolean {
          return nodeEnv === NodeEnv.Production;
        }
      `,
    },
    {
      name: 'use case imports model types and services',
      filename: 'src/modules/example/application/publish-example.use-case.ts',
      code: `
        import { ExampleService } from './example.service';
        import type { Example } from '../model/example.types';

        export class PublishExampleUseCase {
          constructor(private readonly service: ExampleService) {}

          execute(example: Example): Promise<unknown> {
            return this.service.publish(example.id);
          }
        }
      `,
    },
    {
      name: 'service may import a DTO (not covered by this rule)',
      filename: 'src/modules/example/application/example.service.ts',
      code: `
        import { CreateExampleDto } from '../api/dto/create-example.dto';

        export class ExampleService {
          create(dto: CreateExampleDto): void {}
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'domain file imports an API DTO',
      filename: 'src/modules/example/domain/example.policy.ts',
      code: `
        import type { CreateExampleDto } from '../api/dto/create-example.dto';

        export function create(input: CreateExampleDto): void {}
      `,
      errors: [{ messageId: 'noDtoImport' }],
    },
    {
      name: 'domain file imports from a nested DTO path',
      filename: 'src/modules/example/domain/example.entity.ts',
      code: `
        import { CreateExampleDto } from '../api/dto/nested/create-example.dto';

        export function build(input: CreateExampleDto): void {}
      `,
      errors: [{ messageId: 'noDtoImport' }],
    },
    {
      name: 'use case imports an API DTO',
      filename: 'src/modules/example/application/publish-example.use-case.ts',
      code: `
        import type { CreateExampleDto } from '../api/dto/create-example.dto';

        export class PublishExampleUseCase {
          execute(dto: CreateExampleDto): void {}
        }
      `,
      errors: [{ messageId: 'noDtoImport' }],
    },
    {
      name: 'domain file imports a response DTO',
      filename: 'src/modules/example/domain/example.policy.ts',
      code: `
        import type { ExampleResponseDto } from '../api/dto/example-response.dto';

        export function toResponse(): ExampleResponseDto {
          return { id: '1' } as ExampleResponseDto;
        }
      `,
      errors: [{ messageId: 'noDtoImport' }],
    },
  ],
});
