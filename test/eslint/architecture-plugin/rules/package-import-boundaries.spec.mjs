import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import { architectureImportRuleOptions } from '../../../../eslint/architecture.config.mjs';
import rule from '../../../../eslint/architecture-plugin/rules/no-restricted-layer-imports.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser,
  },
});

ruleTester.run('architecture/package-import-boundaries', rule, {
  valid: [
    {
      name: 'password adapter owns bcrypt',
      filename: 'src/modules/auth/adapters/password-hash.adapter.ts',
      code: `import { compare } from 'bcrypt';`,
      options: [architectureImportRuleOptions],
    },
    {
      name: 'JWT adapter owns the JWT service',
      filename: 'src/modules/auth/adapters/jwt-token.adapter.ts',
      code: `import { JwtService } from '@nestjs/jwt';`,
      options: [architectureImportRuleOptions],
    },
    {
      name: 'auth module may register the JWT vendor module',
      filename: 'src/modules/auth/auth.module.ts',
      code: `import { JwtModule } from '@nestjs/jwt';`,
      options: [architectureImportRuleOptions],
    },
  ],
  invalid: [
    {
      name: 'auth service cannot import bcrypt',
      filename: 'src/modules/auth/application/auth.service.ts',
      code: `import { compare } from 'bcrypt';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'repository cannot import bcrypt',
      filename: 'src/modules/users/infrastructure/users.repository.ts',
      code: `import { hashSync } from 'bcrypt';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'auth guard cannot import JWT vendor',
      filename: 'src/core/auth/jwt-auth.guard.ts',
      code: `import { JwtService } from '@nestjs/jwt';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'auth service cannot import JWT vendor',
      filename: 'src/modules/auth/application/auth.service.ts',
      code: `import { JwtService } from '@nestjs/jwt';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'another module adapter cannot import bcrypt',
      filename: 'src/modules/payments/adapters/password.adapter.ts',
      code: `import { compare } from 'bcrypt';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'bcrypt subpath cannot bypass ownership',
      filename: 'src/modules/auth/application/auth.service.ts',
      code: `import bcrypt from 'bcrypt/promises';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'JWT re-export cannot bypass ownership',
      filename: 'src/modules/auth/index.ts',
      code: `export { JwtService } from '@nestjs/jwt';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'dynamic bcrypt import cannot bypass ownership',
      filename: 'src/modules/auth/application/auth.service.ts',
      code: `export const loadBcrypt = () => import('bcrypt');`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'template-literal bcrypt import cannot bypass ownership',
      filename: 'src/modules/auth/application/auth.service.ts',
      code: 'export const loadBcrypt = () => import(`bcrypt`);',
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
    {
      name: 'validation vendor subpath cannot bypass ownership',
      filename: 'src/modules/articles/api/dto/create-article.dto.ts',
      code: `import { ValidationError } from 'class-validator/types/validation/ValidationError';`,
      options: [architectureImportRuleOptions],
      errors: [{ messageId: 'forbiddenImport' }],
    },
  ],
});
