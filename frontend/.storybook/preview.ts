import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

// ── MSW — API mocking in Storybook (#1546) ─────────────────────────────────
// Start the MSW Service Worker before any story renders so that stories which
// trigger API calls get the same mocked responses as Vitest unit tests.
// The worker uses the same handlers defined in src/test-utils/msw/handlers.ts.
import { worker } from './msw'

worker.start({
  // Stories load over file:// or localhost; suppress "no-handler" warnings for
  // non-API requests (assets, Storybook internals, etc.).
  onUnhandledRequest: 'bypass',
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'hsl(0 0% 100%)' },
        { name: 'dark', value: 'hsl(222 47% 8%)' },
      ],
    },
    a11y: { test: 'error' },
    // Expose the MSW worker on story parameters so individual stories can
    // override handlers with:
    //   parameters: { msw: { handlers: [ http.get('/api/wastes', ...) ] } }
    msw: { worker },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals.backgrounds?.value === 'hsl(222 47% 8%)'
      document.documentElement.classList.toggle('dark', isDark)
      return Story()
    },
  ],
}

export default preview
