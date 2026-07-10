import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import rule from '../../../../eslint/architecture-plugin/rules/no-definite-assignment-assertions.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser,
  },
});

ruleTester.run('architecture/no-definite-assignment-assertions', rule, {
  valid: [
    {
      name: 'decorated DTO field uses a declaration',
      code: `
        declare function Field(): PropertyDecorator;

        export class ExampleDto {
          @Field()
          declare readonly title: string;
        }
      `,
    },
    {
      name: 'field is assigned by the constructor',
      code: `
        export class Example {
          readonly title: string;

          constructor(title: string) {
            this.title = title;
          }
        }
      `,
    },
    {
      name: 'optional field needs no assertion',
      code: `
        export class ExampleQuery {
          readonly limit?: number;
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'DTO field uses a definite-assignment assertion',
      code: `
        export class ExampleDto {
          readonly title!: string;
        }
      `,
      errors: [{ messageId: 'noDefiniteAssignment' }],
    },
    {
      name: 'private field uses a definite-assignment assertion',
      code: `
        export class Example {
          private value!: string;
        }
      `,
      errors: [{ messageId: 'noDefiniteAssignment' }],
    },
  ],
});
