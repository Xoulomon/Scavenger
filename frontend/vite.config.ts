/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Route-level code splitting (issue #1676): pages are lazy-loaded via
        // React.lazy + Suspense in src/routes, so Rollup emits one chunk per
        // route automatically. The manualChunks function below only groups
        // shared vendor code so it is not duplicated across route chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('@stellar/stellar-sdk') || id.includes('@stellar/freighter-api')) {
            return 'stellar'
          }
          if (
            id.includes('@radix-ui/react-dialog') ||
            id.includes('@radix-ui/react-dropdown-menu') ||
            id.includes('@radix-ui/react-select')
          ) {
            return 'ui'
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query'
          }
          if (
            id.includes('leaflet') ||
            id.includes('react-leaflet') ||
            id.includes('leaflet.markercluster')
          ) {
            return 'map'
          }
          if (id.includes('firebase')) {
            return 'firebase'
          }
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
            return 'react-vendor'
          }
          return 'vendor'
        }
      },
      chunkSizeWarningLimit: 1000,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true
        }
      }
    }
  },
  // Expose validated env vars to the client bundle. Values are read from
  // VITE_ prefixed vars; runtime validation lives in `src/config` (zod).
  define: {
    __APP_ENV__: JSON.stringify({
      MODE: mode,
      ...Object.fromEntries(Object.entries(env).map(([key, value]) => [key, value]))
    })
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Include optimized image formats and fonts in the precache manifest.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,avif,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/(participants|wastes|metrics|incentives|stats)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-response-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 // 1 minute
              },
              networkTimeoutSeconds: 5
            }
          },
          {
            urlPattern: /^https:\/\/.*\.stellar\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stellar-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                return `${request.url}?${Date.now()}`
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.ipfs\.io\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ipfs-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'backend-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60
              }
            }
          },
          {
            // Cache optimized images (WebP/AVIF) with a long-lived strategy.
            urlPattern: /\.(?:webp|avif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Cache subsetted fonts with a long-lived strategy.
            urlPattern: /\.(?:woff2?|ttf|otf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Scavenger',
        short_name: 'Scavenger',
        description: 'Waste tracking and recycling platform',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/context': path.resolve(__dirname, './src/context'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/stories': path.resolve(__dirname, './src/stories'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/assets': path.resolve(__dirname, './src/assets'),
      '@/i18n': path.resolve(__dirname, './src/i18n'),
      '@/test-utils': path.resolve(__dirname, './src/test-utils')
    }
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test-utils/setup.tsx'],
          css: false,
          // Snapshot tests for design-system component variants (issue #1290).
          // Snapshots are stored in __snapshots__ directories next to each test.
          // To update snapshots after an intentional visual change, run:
          //   npx vitest run -u frontend/src/design-system
          // Review the updated .snap files before committing them.
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
              'src/**/*.d.ts',
              'src/**/*.test.{ts,tsx}',
              'src/**/*.spec.{ts,tsx}',
              'src/test-utils/**',
              'src/**/*.stories.tsx'
            ],
            lines: 85,
            functions: 85,
            branches: 85,
            statements: 85,
            perFile: true
          }
        }
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook')
          })
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium'
              }
            ]
          }
        }
      }
    ]
  }
})
