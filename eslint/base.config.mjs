import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Disallow console statements so production logging uses approved loggers.
      'no-console': 'error',
      // Prevent committed debugger breakpoints.
      'no-debugger': 'error',
      // Require strict equality while allowing safe null checks.
      eqeqeq: ['error', 'smart'],
      // Require braces to avoid ambiguous control flow.
      curly: ['error', 'all'],
      // Avoid terse coercions that hide intent.
      'no-implicit-coercion': 'error',
      // Prefer shorthand object syntax for consistency.
      'object-shorthand': ['error', 'always'],
      // Prefer template strings over string concatenation.
      'prefer-template': 'error',
      // Let simple-import-sort own import ordering.
      'sort-imports': 'off',
    },
  },
];
