import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tseslint from 'typescript-eslint';

const configDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export default [
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: configDir,
      },
    },
    rules: {
      // Allow ts-expect-error only when the reason is documented.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 5,
        },
      ],
      // Keep object shape declarations consistent with interfaces.
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      // Prefer type-only imports so runtime imports stay intentional.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      // Avoid returning void expressions where values are expected.
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],
      // Block any so type boundaries remain explicit.
      '@typescript-eslint/no-explicit-any': 'error',
      // Require promises to be awaited or intentionally handled.
      '@typescript-eslint/no-floating-promises': 'error',
      // Prevent accidental stringification of unsafe values.
      '@typescript-eslint/no-base-to-string': 'error',
      // Allow empty constructors but reject other empty functions.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['constructors'] }],
      // Avoid class wrappers that do not need class semantics.
      '@typescript-eslint/no-extraneous-class': 'error',
      // Catch promises used where sync booleans or callbacks are expected.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Avoid bypassing null safety with non-null assertions.
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Prevent emitted side-effect imports from type-only imports.
      '@typescript-eslint/no-import-type-side-effects': 'error',
      // Remove redundant union/intersection type constituents.
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      // Catch duplicate enum values that hide bugs.
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      // Avoid ambiguous empty object types.
      '@typescript-eslint/no-empty-object-type': 'error',
      // Catch conditions TypeScript can prove are unnecessary.
      '@typescript-eslint/no-unnecessary-condition': 'error',
      // Remove type assertions TypeScript does not need.
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // Prevent passing unsafe values into typed APIs.
      '@typescript-eslint/no-unsafe-argument': 'error',
      // Prevent assigning unsafe values.
      '@typescript-eslint/no-unsafe-assignment': 'error',
      // Prevent calling unsafe values.
      '@typescript-eslint/no-unsafe-call': 'error',
      // Prevent reading members from unsafe values.
      '@typescript-eslint/no-unsafe-member-access': 'error',
      // Prevent returning unsafe values from typed functions.
      '@typescript-eslint/no-unsafe-return': 'error',
      // Catch unused TypeScript variables before unused-imports cleanup.
      '@typescript-eslint/no-unused-vars': 'error',
      // Avoid constructors that add no behavior.
      '@typescript-eslint/no-useless-constructor': 'error',
      // Require thrown values to be Error-like.
      '@typescript-eslint/only-throw-error': 'error',
      // Prefer rejected Error objects for catch consistency.
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      // Prefer nullish coalescing for nullable fallback logic.
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      // Prefer optional chaining for nullable property access.
      '@typescript-eslint/prefer-optional-chain': 'error',
      // Prefer readonly where mutation is not needed.
      '@typescript-eslint/prefer-readonly': 'error',
      // Require async only when await is actually used.
      '@typescript-eslint/require-await': 'error',
      // Return awaited promises inside try/catch for correct error handling.
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      // Restrict template expressions to safe primitive values.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowBoolean: true,
          allowNumber: true,
        },
      ],
      // Require switch statements to cover all union members.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
];
