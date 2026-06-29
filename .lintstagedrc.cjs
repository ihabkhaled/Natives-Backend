const path = require('path');

const buildEslintCommand = fileNames =>
  `eslint ${fileNames
    .map(f => path.relative(process.cwd(), f))
    .join(' ')} --fix`;

const buildAddToGitAfterFix = fileNames =>
  `git add ${fileNames.map(f => path.relative(process.cwd(), f)).join(' ')}`;

module.exports = {
  'src/**/*.ts': [buildEslintCommand, buildAddToGitAfterFix],
  'test/**/*.ts': [buildEslintCommand, buildAddToGitAfterFix],
  '**/*.json': [buildAddToGitAfterFix],
};
