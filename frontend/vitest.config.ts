import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Prevent committed .only calls from silently disabling the rest of a suite.
    // Mirrors the ESLint no-only-tests rule at the runner level.
    forbidOnly: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Enforce the 85%+ coverage target from the refactor issues (#1674-#1677).
      // Thresholds are applied per file so newly added primitives, schemas,
      // routes and memoized components cannot regress coverage silently.
      thresholds: {
        perFile: true,
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85
      },
      include: [
        'src/components/ui/**/*.{ts,tsx}',
        'src/lib/schemas/**/*.{ts,tsx}',
        'src/routes/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}'
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test-utils/**',
        'src/main.tsx'
      ]
    },
    env: {
      VITE_CONTRACT_ID: 'TEST_CONTRACT_ID',
      VITE_RPC_URL: 'https://testnet.sorobanrpc.com',
      VITE_NETWORK: 'TESTNET'
    },
    projects: [
      {
        // Unit and component tests
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test-utils/setup.tsx'],
          // Covers UI primitives (#1674), form schemas (#1675),
          // route-level lazy loading (#1676) and memoized components (#1677).
          include: [
            'src/components/ui/**/*.test.{ts,tsx}',
            'src/lib/schemas/**/*.test.{ts,tsx}',
            'src/routes/**/*.test.{ts,tsx}',
            'src/components/**/*.test.{ts,tsx}',
            'src/**/*.test.{ts,tsx}'
          ],
          env: {
            VITE_CONTRACT_ID: 'TEST_CONTRACT_ID',
            VITE_RPC_URL: 'https://testnet.sorobanrpc.com',
            VITE_NETWORK: 'TESTNET'
          }
        }
      },
      {
        // Storybook interaction and accessibility tests
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          globals: true,
          browser: {
            enabled: true,
            headless: true,
            provider: 'playwright',
            instances: [{ browser: 'chromium' }]
          },
          setupFiles: ['.storybook/vitest.setup.ts']
        }
      }
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
