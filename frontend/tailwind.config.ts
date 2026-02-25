import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2fbf8',
          100: '#d1f3e8',
          500: '#16a34a',
          700: '#15803d',
          900: '#14532d'
        }
      }
    }
  },
  plugins: []
} satisfies Config
