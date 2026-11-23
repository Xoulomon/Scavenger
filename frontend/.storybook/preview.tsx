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
  onUnhandledRequest: 'bypass'
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'hsl(0 0% 100%)' },
        { name: 'dark', value: 'hsl(222 47% 8%)' }
      ]
    },
    // ── Accessibility for shared UI primitives (#1674) ─────────────────────
    // The shared Button/Input/Modal primitives must be a11y-clean; fail the
    // story (and CI a11y run) on any violation so regressions are caught.
    a11y: {
      test: 'error',
      config: {
        rules: [
          // Modal renders into a portal; ensure focus-trap/dialog semantics
          // are validated rather than skipped.
          { id: 'aria-dialog-name', enabled: true },
          { id: 'aria-required-attr', enabled: true }
        ]
      }
    },
    // Expose the MSW worker on story parameters so individual stories can
    // override handlers with:
    //   parameters: { msw: { handlers: [ http.get('/api/wastes', ...) ] } }
    msw: { worker },
    // Shared primitives render best at a predictable viewport; stories can
    // override via parameters.layout / parameters.viewport.
    layout: 'centered'
  },
  decorators: [
    // ── Design-system decorator (#1674) ────────────────────────────────────
    // Applies the theme (light/dark) and a consistent surface wrapper so the
    // shared Button/Input/Modal primitives render against the same tokens
    // they use in the app. Also resets the portal root between stories so
    // Modal stories don't leak DOM nodes.
    (Story, context) => {
      const isDark = context.globals.backgrounds?.value === 'hsl(222 47% 8%)'
      document.documentElement.classList.toggle('dark', isDark)

      // Ensure a stable portal root exists for Modal stories.
      let portalRoot = document.getElementById('storybook-portal-root')
      if (!portalRoot) {
        portalRoot = document.createElement('div')
        portalRoot.id = 'storybook-portal-root'
        document.body.appendChild(portalRoot)
      }

      // Clean up any leftover portal content from a previous story.
      portalRoot.innerHTML = ''

      const wrapper = document.createElement('div')
      wrapper.className = 'p-4 bg-background text-foreground'
      wrapper.setAttribute('data-storybook-surface', '')

      const rendered = Story()
      // Story() may return a React element; wrap it via a container component
      // so the surface styling applies without altering the story output.
      const Wrapped = () => rendered
      const container = document.createElement('div')
      container.className = wrapper.className
      container.setAttribute('data-storybook-surface', '')

      // Return the story element; the surface class is applied through the
      // decorator's container by Storybook's rendering pipeline.
      return (
        <div className="p-4 bg-background text-foreground" data-storybook-surface="">
          {rendered}
        </div>
      )
    }
  ]
}

export default preview
