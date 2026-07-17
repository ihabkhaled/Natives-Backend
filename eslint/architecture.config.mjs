import architecturePlugin from "./architecture-plugin.mjs";
import { packageImportBoundaries } from "./package-boundaries.config.mjs";

// -----------------------------------------------------------------------------
// Layered-architecture enforcement (the heart of the strict NestJS workspace).
//
// The layers and their boundaries are expressed as path/suffix regexes so the
// custom `architecture/*` rules can enforce them. To adapt conventions, change
// `moduleSuffix` and the `layer` map below — never hardcode entity names in the
// rule implementations under architecture-plugin/.
// See rules/01-architecture-and-module-boundaries.md.
// -----------------------------------------------------------------------------

// Module naming is the single place to adapt layer suffix conventions.
export const moduleSuffix = {
  controller: "controller",
  service: "service",
  repository: "repository",
  useCase: "use-case",
};

// Derive the `files` glob for a module suffix.
export const suffixGlob = (name) => `**/*.${name}.ts`;

// Derive the import-path regex for a module suffix.
export const suffixPattern = (name) => `\\.${name}(?:\\.ts)?$`;

export const layer = {
  controller: suffixPattern(moduleSuffix.controller),
  service: suffixPattern(moduleSuffix.service),
  repository: suffixPattern(moduleSuffix.repository),
  useCase: suffixPattern(moduleSuffix.useCase),
  // Folder layers are matched by directory segment rather than file suffix.
  application: "/application/",
  apiDto: "/api/dto(?:/|$)",
  infrastructure: "/infrastructure/",
};

export const layerImportBoundaries = [
  {
    from: [layer.controller],
    allowIn: ["/app\\.controller(?:\\.ts)?$"],
    forbid: [layer.repository, layer.infrastructure],
    message:
      "Controllers must stay HTTP-only and depend on use cases, DTOs, decorators, and guards — never repositories or infrastructure.",
  },
  {
    from: [layer.application],
    forbid: [layer.controller],
    message:
      "Application use cases and services must not depend on controllers.",
  },
  {
    from: [layer.service],
    forbid: [layer.controller],
    message: "Services must stay focused and must not depend on controllers.",
  },
  {
    from: [layer.repository],
    forbid: [layer.controller, layer.service, layer.useCase, layer.apiDto],
    message:
      "Repositories must only own persistence access — no controllers, services, use cases, or API DTOs.",
  },
  {
    from: [layer.apiDto],
    forbid: [layer.service, layer.repository, layer.infrastructure],
    message: "DTOs must remain API-boundary declarations only.",
  },
];

export const restrictedRuntimeAccess = [
  {
    object: "process",
    property: "env",
    allowIn: [
      "/config/",
      "/bootstrap/",
      "\\.config(?:\\.ts)?$",
      "\\.providers?(?:\\.ts)?$",
    ],
    message:
      "Read process.env only in config, bootstrap, or provider files (rules/17).",
  },
];

export const architectureImportRuleOptions = {
  policies: [...layerImportBoundaries, ...packageImportBoundaries],
  restrictedAccess: restrictedRuntimeAccess,
};

// Path patterns for class-based implementation layers where only the layer
// class/function may live in the file. Mappers, factories, and pure-function
// modules are intentionally excluded because the function *is* the layer.
// Folder patterns match at ANY depth (`.+` not `[^/]+`): a vendor file nested
// under adapters/ is still an implementation-layer file and must not escape the
// rule. These regexes are the rules' own internal re-check; the `files` globs
// below must stay at least as broad. See test/eslint/config-rule-activation.spec.mjs.
export const implementationLayerPatterns = [
  "\\.controller(?:\\.ts)?$",
  "\\.service(?:\\.ts)?$",
  "\\.use-case(?:\\.ts)?$",
  "\\.repository(?:\\.ts)?$",
  "\\.adapter(?:\\.ts)?$",
  "/adapters?/.+\\.ts$",
  "\\.guard(?:\\.ts)?$",
  "/guards?/.+\\.ts$",
  "\\.interceptor(?:\\.ts)?$",
  "/interceptors?/.+\\.ts$",
  "\\.pipe(?:\\.ts)?$",
  "/pipes?/.+\\.ts$",
  "\\.filter(?:\\.ts)?$",
  "/filters?/.+\\.ts$",
  "\\.handler(?:\\.ts)?$",
  "/handlers?/.+\\.ts$",
];

// Glob equivalents of implementationLayerPatterns. Flat-config `files` entries
// are minimatch globs, not regexes — a regex string there never matches, which
// silently disables the whole override. The custom rules still re-check the
// regex patterns they receive as options, so these globs may be broader but
// never narrower than the patterns above.
export const implementationLayerGlobs = [
  "**/*.controller.ts",
  "**/*.service.ts",
  "**/*.use-case.ts",
  "**/*.repository.ts",
  "**/*.adapter.ts",
  "**/adapter/**/*.ts",
  "**/adapters/**/*.ts",
  "**/*.guard.ts",
  "**/guard/**/*.ts",
  "**/guards/**/*.ts",
  "**/*.interceptor.ts",
  "**/interceptor/**/*.ts",
  "**/interceptors/**/*.ts",
  "**/*.pipe.ts",
  "**/pipe/**/*.ts",
  "**/pipes/**/*.ts",
  "**/*.filter.ts",
  "**/filter/**/*.ts",
  "**/filters/**/*.ts",
  "**/*.handler.ts",
  "**/handler/**/*.ts",
  "**/handlers/**/*.ts",
];

export const adapterFileGlobs = [
  "**/*.adapter.ts",
  "**/adapter/**/*.ts",
  "**/adapters/**/*.ts",
];

export const architectureBaseConfig = {
  files: ["**/*.ts"],
  plugins: {
    architecture: architecturePlugin,
  },
  rules: {
    // Enforce layer imports, gateway imports, and restricted runtime access.
    "architecture/no-restricted-layer-imports": [
      "error",
      architectureImportRuleOptions,
    ],
    // Enforce module ownership: import from another module's public/model layer only.
    "architecture/no-cross-module-internal-imports": "error",
    // `field!: Type` is an unchecked initialization escape hatch. DTOs use
    // `declare`; stateful classes initialize fields in constructors.
    "architecture/no-definite-assignment-assertions": "error",
  },
};

export const serviceConcurrencyRestrictions = [
  "all",
  "allSettled",
  "any",
  "race",
].map((method) => ({
  selector: `CallExpression[callee.object.name='Promise'][callee.property.name='${method}']`,
  message: `Do not use Promise.${method} inside service files. Move concurrent orchestration to a dedicated helper or use case.`,
}));

export const architectureOverrideConfigs = [
  {
    files: [suffixGlob(moduleSuffix.controller)],
    rules: {
      // Controllers must stay HTTP-only and delegate to use cases.
      "architecture/controller-no-logic": "error",
    },
  },
  {
    files: implementationLayerGlobs,
    rules: {
      // Implementation-layer files contain only the class/function that belongs
      // to the layer. No module-level constants, enums, interfaces, types, or
      // helper functions. The only allowed exception is a file-local LOG_PREFIX
      // const (or names configured in allowedVariableNames).
      "architecture/no-inline-layer-declarations": [
        "error",
        { filePatterns: implementationLayerPatterns },
      ],
      // One class per implementation-layer file — the layer class is the file
      // (rules/23). A second helper class belongs in its own owner file.
      "max-classes-per-file": ["error", 1],
      // Non-service implementation methods get a conservative readability
      // budget. Services are tightened to 20 by the later override.
      "max-lines-per-function": [
        "error",
        {
          max: 40,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: false,
        },
      ],
    },
  },
  {
    files: [suffixGlob(moduleSuffix.service)],
    rules: {
      // Services avoid inline concurrency orchestration.
      "no-restricted-syntax": ["error", ...serviceConcurrencyRestrictions],
      // Keep service methods small and readable.
      "max-lines-per-function": [
        "error",
        {
          max: 20,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: false,
        },
      ],
      // Dependency direction is one-way: use cases call services, not the reverse.
      "architecture/no-use-case-import-in-service": "error",
    },
  },
  {
    files: adapterFileGlobs,
    rules: {
      // Adapters avoid inline concurrency orchestration.
      "no-restricted-syntax": ["error", ...serviceConcurrencyRestrictions],
    },
  },
  {
    files: [
      "**/domain/**/*.ts",
      suffixGlob(moduleSuffix.useCase),
      "**/*.policy.ts",
      "**/*.entity.ts",
      "**/*.state-machine.ts",
    ],
    rules: {
      // Domain logic and use cases depend on model types, not API DTOs.
      "architecture/no-dto-import-in-domain-or-use-case": "error",
    },
  },
];
