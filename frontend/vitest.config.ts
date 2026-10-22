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
    },
    env: {
      VITE_CONTRACT_ID: 'TEST_CONTRACT_ID',
      VITE_RPC_URL: 'https://testnet.sorobanrpc.com',
      VITE_NETWORK: 'TESTNET',
    },
    projects: [
      {
        // Unit and component tests
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test-utils/setup.tsx'],
          include: ['src/**/*.test.{ts,tsx}'],
          env: {
            VITE_CONTRACT_ID: 'TEST_CONTRACT_ID',
            VITE_RPC_URL: 'https://testnet.sorobanrpc.com',
            VITE_NETWORK: 'TESTNET',
          },
        },
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
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})