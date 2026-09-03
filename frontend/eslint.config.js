import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort'
import prettierConfig from 'eslint-config-prettier'
import { createRequire } from 'module'
import { fileURLToPath } from 'node:url'
import { dirname } from 'path'

const require_ = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the custom error-message-format rule from the root eslint-rules directory
const errorMessageFormat = require_('../eslint-rules/error-message-format.js')

const sharedPlugins = {
  '@typescript-eslint': tsPlugin,
  react: reactPlugin,
  'react-hooks': reactHooksPlugin,
  'jsx-a11y': jsxA11yPlugin,
  import: importPlugin,
  'simple-import-sort': simpleImportSortPlugin,
  'error-message-format': {
    rules: { 'error-message-format': errorMessageFormat },
  },
}

const sharedSettings = {
  react: { version: 'detect' },
  'import/resolver': {
    typescript: {},
    node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
  },
}

const sharedRules = {
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  'react/prop-types': 'off',
  'react/react-in-jsx-scope': 'off',
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'import/no-unresolved': 'error',
  'import/named': 'error',
  'import/default': 'error',
  'import/namespace': 'error',
  'import/export': 'error',
  'simple-import-sort/imports': 'error',
  'simple-import-sort/exports': 'error',
  'no-console': ['error', { allow: ['warn', 'error'] }],
  'no-debugger': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
  curly: ['error', 'all'],
  'require-jsdoc': 'off',
  'valid-jsdoc': 'off',
  'error-message-format/error-message-format': 'error',
}

export default [
  // Production source files
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['dist', 'node_modules', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**', '*.stories.tsx', '*.stories.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: sharedPlugins,
    settings: sharedSettings,
    rules: {
      ...sharedRules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // src/lib utilities: prefer `undefined` over `null` for absent values
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      // Convention: prefer `undefined` over `null` for absent values in lib utilities.
      // External API wrappers that legitimately return null are exempt — add an
      // eslint-disable-next-line comment with a reason.
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'ReturnStatement[argument.type="Literal"][argument.value=null]',
          message:
            'Prefer returning `undefined` for absent values in lib utilities. ' +
            'If this wraps an external API that returns null, add an ' +
            'eslint-disable-next-line comment explaining why.',
        },
      ],
    },
  },
  // Test files: relax no-explicit-any and no-unused-vars
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: sharedPlugins,
    settings: sharedSettings,
    rules: {
      ...sharedRules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Storybook stories: allow console.log
  {
    files: ['*.stories.tsx', '*.stories.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: sharedPlugins,
    settings: sharedSettings,
    rules: {
      ...sharedRules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },
  prettierConfig,
]
