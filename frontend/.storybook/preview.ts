import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

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
