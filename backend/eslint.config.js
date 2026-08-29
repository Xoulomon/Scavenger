const baseConfig = require('../eslint.config.base.js');

module.exports = {
  ...baseConfig,
  env: {
    node: true,
    jest: true,
  },
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    ...baseConfig.rules,
    // Backend-specific rules
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
