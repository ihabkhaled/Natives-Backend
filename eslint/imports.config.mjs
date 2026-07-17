import importX from "eslint-plugin-import-x";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

export default {
  files: ["**/*.ts"],
  plugins: {
    "import-x": importX,
    "simple-import-sort": simpleImportSort,
    "unused-imports": unusedImports,
  },
  rules: {
    // Disable core unused vars so TypeScript and unused-imports own this.
    "no-unused-vars": "off",
    // Prevent shallow import cycles between modules.
    "import-x/no-cycle": ["error", { maxDepth: 1 }],
    // Avoid duplicate imports from the same module.
    "import-x/no-duplicates": "error",
    // Keep export declarations sorted consistently.
    "simple-import-sort/exports": "error",
    // Keep import declarations sorted consistently.
    "simple-import-sort/imports": "error",
    // Remove unused import declarations.
    "unused-imports/no-unused-imports": "error",
    // Enforce unused variable cleanup with underscore escape hatches.
    "unused-imports/no-unused-vars": [
      "error",
      {
        args: "after-used",
        argsIgnorePattern: "^_",
        ignoreRestSiblings: true,
        vars: "all",
        varsIgnorePattern: "^_",
      },
    ],
  },
};
