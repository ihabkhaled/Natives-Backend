import { defineConfig } from 'eslint/config';

import {
  architectureBaseConfig,
  architectureOverrideConfigs,
} from './eslint/architecture.config.mjs';
import baseConfig from './eslint/base.config.mjs';
import ignoresConfig from './eslint/ignores.config.mjs';
import importsConfig from './eslint/imports.config.mjs';
import {
  prettierConflictConfig,
  prettierRuleConfig,
} from './eslint/prettier.config.mjs';
import promiseConfig from './eslint/promise.config.mjs';
import regexpConfig from './eslint/regexp.config.mjs';
import securityConfig from './eslint/security.config.mjs';
import sonarConfig from './eslint/sonar.config.mjs';
import testConfig from './eslint/test.config.mjs';
import typescriptConfig from './eslint/typescript.config.mjs';
import unicornConfig from './eslint/unicorn.config.mjs';

export default defineConfig(
  ignoresConfig,
  ...baseConfig,
  ...typescriptConfig,
  prettierRuleConfig,
  securityConfig,
  importsConfig,
  promiseConfig,
  regexpConfig,
  sonarConfig,
  unicornConfig,
  architectureBaseConfig,
  testConfig,
  ...architectureOverrideConfigs,
  prettierConflictConfig,
);
