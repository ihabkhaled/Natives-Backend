import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export const prettierRuleConfig = {
  files: ['**/*.ts'],
  plugins: {
    prettier: prettierPlugin,
  },
  rules: {
    // Enforce project formatting through ESLint. Keep in sync with .prettierrc.
    'prettier/prettier': [
      'error',
      {
        trailingComma: 'all',
        singleQuote: true,
        printWidth: 80,
        arrowParens: 'avoid',
      },
    ],
  },
};

// Disable ESLint stylistic rules that conflict with Prettier formatting.
export const prettierConflictConfig = prettierConfig;
