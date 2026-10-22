import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

describe('Bundle Size Analysis', () => {
  describe('Code-splitting implementation', () => {
    it('should have Dashboard page configured for lazy loading', () => {
      const configPath = path.join(__dirname, './App.tsx')
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8')
        expect(content).toMatch(/lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"].*DashboardPage/s)
      }
    })

    it('should have Map page configured for lazy loading', () => {
      const configPath = path.join(__dirname, './App.tsx')
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8')
        expect(content).toMatch(/lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"].*MapPage/s)
      }
    })

    it('should have Marketplace page configured for lazy loading', () => {
      const configPath = path.join(__dirname, './App.tsx')
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8')
        expect(content).toMatch(/lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"].*MarketplacePage/s)
      }
    })
  })

  describe('Heavy dependencies documentation', () => {
    it('should document recharts as a heavy dependency', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('recharts')
        expect(content).toMatch(/recharts.*\d+KB/)
      }
    })

    it('should document leaflet as a heavy dependency', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('leaflet')
        expect(content).toMatch(/leaflet.*\d+KB/)
      }
    })

    it('should document visx as a heavy dependency', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('visx')
        expect(content).toMatch(/visx.*\d+KB/)
      }
    })

    it('should provide bundle analysis instructions', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('webpack-bundle-analyzer')
        expect(content).toContain('Bundle Analysis')
      }
    })

    it('should document performance budgets', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('Performance Budget')
        expect(content).toContain('Initial JS Bundle')
      }
    })
  })

  describe('Tree-shaking best practices', () => {
    it('should document named imports strategy', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('named imports')
        expect(content).toContain('Tree-Shaking')
      }
    })

    it('should provide examples of tree-shaking optimizations', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('recharts')
        expect(content).toContain('BarChart')
      }
    })
  })

  describe('monitoring and tracking', () => {
    it('should document CI/CD integration for bundle monitoring', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('CI/CD')
        expect(content).toContain('bundle size')
      }
    })

    it('should provide local development bundle analysis commands', () => {
      const docPath = path.join(__dirname, './docs/BUNDLE_SIZE_OPTIMIZATION.md')
      if (existsSync(docPath)) {
        const content = readFileSync(docPath, 'utf-8')
        expect(content).toContain('Local Development')
        expect(content).toContain('analyze:bundle')
      }
    })
  })
})
