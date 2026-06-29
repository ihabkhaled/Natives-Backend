import unicornPlugin from 'eslint-plugin-unicorn';

export default {
  files: ['**/*.ts'],
  plugins: {
    unicorn: unicornPlugin,
  },
  rules: {
    // Avoid passing callbacks in a way that obscures arguments.
    'unicorn/no-array-callback-reference': 'error',
    // Avoid nested ternaries that are hard to scan.
    'unicorn/no-nested-ternary': 'error',
    // Remove awaits that do not affect async behavior.
    'unicorn/no-unnecessary-await': 'error',
    // Avoid destructuring patterns that are hard to read.
    'unicorn/no-unreadable-array-destructuring': 'error',
    // Avoid explicit undefined where omission is clearer.
    'unicorn/no-useless-undefined': 'error',
    // Prefer array some for boolean existence checks.
    'unicorn/prefer-array-some': 'error',
    // Prefer includes for membership checks.
    'unicorn/prefer-includes': 'error',
    // Prefer node: protocol imports for Node built-ins.
    'unicorn/prefer-node-protocol': 'error',
    // Prefer startsWith/endsWith over equivalent patterns.
    'unicorn/prefer-string-starts-ends-with': 'error',
  },
};
