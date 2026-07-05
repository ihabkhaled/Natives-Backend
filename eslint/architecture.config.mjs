import architecturePlugin from './architecture-plugin.mjs';
import { packageImportBoundaries } from './package-boundaries.config.mjs';

// -----------------------------------------------------------------------------
// Layered-architecture enforcement (the heart of the strict NestJS workspace).
//
// The layers and their boundaries are expressed as path/suffix regexes so the
// custom `architecture/*` rules can enforce them. To adapt conventions, change
// `moduleSuffix` and the `layer` map below — never hardcode entity names in the
// rule implementations under architecture-plugin/.
// See rules/01-architecture-and-module-boundaries.md.
// -----------------------------------------------------------------------------

// Restrictions target MODULE-LEVEL declarations only (`:matches(Program,
// ExportNamedDeclaration) > ...`). Local consts/types inside a method are
// legitimate; what rules/06 forbids is reusable structure declared at the top
// of a controller/service/repository file. The only permitted file-local
// literal is a `LOG_PREFIX` logging label.
const moduleLevel = selector =>
  `:matches(Program, ExportNamedDeclaration) > ${selector}`;

export const layerDeclarationRestrictions = [
  {
    selector: moduleLevel(
      "VariableDeclaration[kind='const']:not(:has(VariableDeclarator[id.name='LOG_PREFIX']))",
    ),
    message:
      'Do not declare module-level const values inside controller, service, or repository files. Move them to a *.constants.ts module (only a file-local LOG_PREFIX is allowed). See rules/06.',
  },
  {
    selector: moduleLevel('TSEnumDeclaration'),
    message:
      'Do not declare enums inside controller, service, or repository files. Move them to a dedicated enums module (rules/06).',
  },
  {
    selector: moduleLevel('TSInterfaceDeclaration'),
    message:
      'Do not declare interfaces inside controller, service, or repository files. Move them to a dedicated types/model module (rules/06).',
  },
  {
    selector: moduleLevel('TSTypeAliasDeclaration'),
    message:
      'Do not declare type aliases inside controller, service, or repository files. Move them to a dedicated types/model module (rules/06).',
  },
];

export const serviceConcurrencyRestrictions = ['all', 'allSettled', 'any', 'race'].map(
  method => ({
    selector: `CallExpression[callee.object.name='Promise'][callee.property.name='${method}']`,
    message: `Do not use Promise.${method} inside service files. Move concurrent orchestration to a dedicated helper or use case.`,
  }),
);

// Module naming is the single place to adapt layer suffix conventions.
export const moduleSuffix = {
  controller: 'controller',
  service: 'service',
  repository: 'repository',
  useCase: 'use-case',
};

// Derive the `files` glob for a module suffix.
export const suffixGlob = name => `**/*.${name}.ts`;

// Derive the import-path regex for a module suffix.
export const suffixPattern = name => `\\.${name}(?:\\.ts)?$`;

export const layer = {
  controller: suffixPattern(moduleSuffix.controller),
  service: suffixPattern(moduleSuffix.service),
  repository: suffixPattern(moduleSuffix.repository),
  useCase: suffixPattern(moduleSuffix.useCase),
  // Folder layers are matched by directory segment rather than file suffix.
  application: '/application/',
  apiDto: '/api/dto(?:/|$)',
  infrastructure: '/infrastructure/',
};

export const layerImportBoundaries = [
  {
    from: [layer.controller],
    allowIn: ['/app\\.controller(?:\\.ts)?$'],
    forbid: [layer.repository, layer.infrastructure],
    message:
      'Controllers must stay HTTP-only and depend on use cases, DTOs, decorators, and guards — never repositories or infrastructure.',
  },
  {
    from: [layer.application],
    forbid: [layer.controller],
    message:
      'Application use cases and services must not depend on controllers (they may accept/return API DTOs as their I/O contract).',
  },
  {
    from: [layer.service],
    forbid: [layer.controller],
    message: 'Services must stay focused and must not depend on controllers.',
  },
  {
    from: [layer.repository],
    forbid: [layer.controller, layer.service, layer.useCase, layer.apiDto],
    message:
      'Repositories must only own persistence access — no controllers, services, use cases, or API DTOs.',
  },
  {
    from: [layer.apiDto],
    forbid: [layer.service, layer.repository, layer.infrastructure],
    message: 'DTOs must remain API-boundary declarations only.',
  },
];

export const restrictedRuntimeAccess = [
  {
    object: 'process',
    property: 'env',
    allowIn: [
      '/config/',
      '/bootstrap/',
      '\\.config(?:\\.ts)?$',
      '\\.providers?(?:\\.ts)?$',
    ],
    message: 'Read process.env only in config, bootstrap, or provider files (rules/17).',
  },
];

export const architectureImportRuleOptions = {
  policies: [...layerImportBoundaries, ...packageImportBoundaries],
  restrictedAccess: restrictedRuntimeAccess,
};

export const architectureBaseConfig = {
  files: ['**/*.ts'],
  plugins: {
    architecture: architecturePlugin,
  },
  rules: {
    // Enforce layer imports, gateway imports, and restricted runtime access.
    'architecture/no-restricted-layer-imports': ['error', architectureImportRuleOptions],
  },
};

export const architectureOverrideConfigs = [
  {
    files: [suffixGlob(moduleSuffix.controller)],
    rules: {
      // Controllers must stay HTTP-only and delegate to use cases.
      'architecture/controller-no-logic': 'error',
    },
  },
  {
    files: [suffixGlob(moduleSuffix.controller), suffixGlob(moduleSuffix.repository)],
    rules: {
      // Controllers and repositories keep declarations in dedicated modules.
      'no-restricted-syntax': ['error', ...layerDeclarationRestrictions],
    },
  },
  {
    files: [suffixGlob(moduleSuffix.service)],
    rules: {
      // Services avoid local declarations and inline concurrency orchestration.
      'no-restricted-syntax': [
        'error',
        ...layerDeclarationRestrictions,
        ...serviceConcurrencyRestrictions,
      ],
      // Keep service methods small and readable.
      'max-lines-per-function': [
        'error',
        {
          max: 20,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: false,
        },
      ],
    },
  },
];
