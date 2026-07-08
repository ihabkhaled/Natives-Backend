import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';

import rule from '../../../../eslint/architecture-plugin/rules/no-cross-module-internal-imports.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: parser,
  },
});

ruleTester.run('architecture/no-cross-module-internal-imports', rule, {
  valid: [
    {
      name: 'import from own module application layer',
      filename: 'src/modules/articles/api/articles.controller.ts',
      code: `import { ArticlesService } from '../application/articles.service';`,
    },
    {
      name: 'import from own module model layer',
      filename: 'src/modules/articles/application/articles.service.ts',
      code: `import { CreateArticleData } from '../model/article.types';`,
    },
    {
      name: 'import from another module public entrypoint',
      filename: 'src/modules/articles/application/articles.service.ts',
      code: `import { UsersModule } from '../../users';`,
    },
    {
      name: 'import from another module model types',
      filename: 'src/modules/articles/application/articles.service.ts',
      code: `import { User } from '../../users/model/user.types';`,
      options: [{ publicLayerPatterns: ['/(^|/)model/'] }],
    },
    {
      name: 'non-module source file import',
      filename: 'src/core/logger.service.ts',
      code: `import { WinstonAdapter } from '../adapters/winston.adapter';`,
    },
  ],
  invalid: [
    {
      name: 'import another module service',
      filename: 'src/modules/articles/api/articles.controller.ts',
      code: `import { UsersService } from '../../users/application/users.service';`,
      errors: [{ messageId: 'crossModuleInternalImport' }],
    },
    {
      name: 'import another module repository',
      filename: 'src/modules/articles/application/articles.service.ts',
      code: `import { UsersRepository } from '../../users/infrastructure/users.repository';`,
      errors: [{ messageId: 'crossModuleInternalImport' }],
    },
    {
      name: 'import another module domain file',
      filename: 'src/modules/articles/application/articles.service.ts',
      code: `import { createUser } from '../../users/domain/user.entity';`,
      errors: [{ messageId: 'crossModuleInternalImport' }],
    },
    {
      name: 'import another module controller',
      filename: 'src/modules/articles/application/articles.service.ts',
      code: `import { UsersController } from '../../users/api/users.controller';`,
      errors: [{ messageId: 'crossModuleInternalImport' }],
    },
  ],
});
