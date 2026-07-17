import sonarjsPlugin from "eslint-plugin-sonarjs";

export default {
  files: ["**/*.ts"],
  plugins: {
    sonarjs: sonarjsPlugin,
  },
  rules: {
    // Keep cognitive complexity within a readable limit (rules/20, rules/23).
    "sonarjs/cognitive-complexity": ["error", 15],
    // Prefer simpler condition nesting.
    "sonarjs/no-collapsible-if": "error",
    // Catch duplicated branch implementations.
    "sonarjs/no-duplicated-branches": "error",
    // Catch duplicated function bodies.
    "sonarjs/no-identical-functions": "error",
    // Catch functions that always return the same value.
    "sonarjs/no-invariant-returns": "error",
    // Avoid nested switch statements.
    "sonarjs/no-nested-switch": "error",
    // Remove redundant boolean expressions.
    "sonarjs/no-redundant-boolean": "error",
    // Remove redundant jumps after control flow exits.
    "sonarjs/no-redundant-jump": "error",
    // Avoid switch statements that are clearer as if statements.
    "sonarjs/no-small-switch": "error",
    // Let TypeScript and unused-imports own unused-variable checks.
    "sonarjs/no-unused-vars": "off",
    // Avoid catch blocks that only rethrow.
    "sonarjs/no-useless-catch": "error",
    // Prefer returning expressions directly when clearer.
    "sonarjs/prefer-immediate-return": "error",
  },
};
