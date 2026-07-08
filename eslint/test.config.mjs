export default {
  files: ["**/*.spec.ts", "test/**/*.ts"],
  rules: {
    // Keep explicit any blocked even in tests.
    "@typescript-eslint/no-explicit-any": "error",
    // Keep non-null assertions blocked even in tests.
    "@typescript-eslint/no-non-null-assertion": "error",
    // Allow flexible mocked values in test setup.
    "@typescript-eslint/no-unsafe-argument": "off",
    // Allow flexible mocked assignments in tests.
    "@typescript-eslint/no-unsafe-assignment": "off",
    // Allow calling mocked values in tests.
    "@typescript-eslint/no-unsafe-call": "off",
    // Allow member access on mocked values in tests.
    "@typescript-eslint/no-unsafe-member-access": "off",
    // Allow returning mocked values in tests.
    "@typescript-eslint/no-unsafe-return": "off",
    // Keep unnecessary type assertions blocked in tests.
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    // Allow value imports in tests when mocking makes them clearer.
    "@typescript-eslint/consistent-type-imports": "off",
    // Allow simple test-only classes.
    "@typescript-eslint/no-extraneous-class": "off",
    // Allow explicit fallback expressions in tests.
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    // Allow unbound mocked methods in assertions.
    "@typescript-eslint/unbound-method": "off",
    // Allow rejected strings and test fixtures.
    "@typescript-eslint/only-throw-error": "off",
    // Allow promise chains where tests read better.
    "promise/prefer-await-to-then": "off",
    // Allow object-indexed test fixtures and mocks.
    "security/detect-object-injection": "off",
    // Test setup can be longer than production functions.
    "max-lines-per-function": "off",
    // Test files can import across layers to assemble unit fixtures.
    "architecture/no-restricted-layer-imports": "off",
    // Focused tests must never be committed.
    "no-restricted-syntax": [
      "error",
      {
        selector: 'CallExpression[callee.property.name="only"]',
        message: "Focused tests must not be committed.",
      },
    ],
  },
};
