import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // Disallow console statements so production logging uses approved loggers.
      "no-console": "error",
      // Prevent committed debugger breakpoints.
      "no-debugger": "error",
      // Require strict equality while allowing safe null checks.
      eqeqeq: ["error", "smart"],
      // Require braces to avoid ambiguous control flow.
      curly: ["error", "all"],
      // Avoid terse coercions that hide intent.
      "no-implicit-coercion": "error",
      // Prefer shorthand object syntax for consistency.
      "object-shorthand": ["error", "always"],
      // Prefer template strings over string concatenation.
      "prefer-template": "error",
      // Let simple-import-sort own import ordering.
      "sort-imports": "off",
      // Cap cyclomatic complexity so branch-heavy logic is decomposed (rules/23).
      complexity: ["error", { max: 15 }],
      // Cap nesting depth; prefer guard clauses and early returns (rules/20).
      "max-depth": ["error", { max: 3 }],
      // Nested ternaries are unreadable; use branches or a named helper (rules/20).
      // (The unicorn variant is disabled by eslint-config-prettier; the core rule is not.)
      "no-nested-ternary": "error",
      // Prefer early returns over else-after-return blocks (rules/20).
      "no-else-return": ["error", { allowElseIf: false }],
      // Keep parameters immutable; reassignment hides data flow (rules/20).
      "no-param-reassign": "error",
      // Disallow assignments inside return statements (rules/20).
      "no-return-assign": ["error", "always"],
    },
  },
];
