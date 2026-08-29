const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const importPlugin = require('eslint-plugin-import')
const errorMessageFormat = require('../eslint-rules/error-message-format.js')

const path = require('path')

const sharedPlugins = {
  '@typescript-eslint': tsPlugin,
  import: importPlugin,
  'error-message-format': {
    rules: { 'error-message-format': errorMessageFormat },
  },
}

const sharedSettings = {
  'import/resolver': {
    typescript: {
      alwaysTryTypes: true,
      project: './tsconfig.json',
    },
    node: {
      extensions: ['.js', '.ts'],
    },
  },
}

const sharedRules = {
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  'import/no-unresolved': 'error',
  'import/named': 'error',
  'import/default': 'error',
  'import/namespace': 'error',
  'import/export': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
  curly: ['error', 'all'],
  'require-jsdoc': 'off',
  'valid-jsdoc': 'off',
  'error-message-format/error-message-format': 'error',
}

module.exports = [
  // Production source files
  {
    files: ['**/*.ts'],
    ignores: ['dist', 'node_modules', '**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: sharedPlugins,
    settings: sharedSettings,
    rules: {
      ...sharedRules,
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Test files: relax rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: sharedPlugins,
    settings: sharedSettings,
    rules: {
      ...sharedRules,
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
