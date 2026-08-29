const baseConfig = require('../eslint.config.base.js')

module.exports = {
  ...baseConfig,
  root: true,
  env: {
    ...baseConfig.env,
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  parserOptions: {
    ...baseConfig.parserOptions,
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: Array.from(new Set([...(baseConfig.plugins || []), '@typescript-eslint', 'react-hooks', 'react-refresh'])),
  extends: Array.from(new Set([...(baseConfig.extends || []), 'plugin:storybook/recommended'])),
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    ...baseConfig.rules,
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
  },
  overrides: [
    ...(baseConfig.overrides || []),
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['*.stories.tsx', '*.stories.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
}
