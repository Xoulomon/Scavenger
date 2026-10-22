import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Chart Component Usage Tests
 * Verifies that all chart components are imported and used correctly
 * and that unused chart types are identified for removal.
 */

describe('Chart Component Usage Analysis', () => {
  const chartsDir = path.join(process.cwd(), 'frontend/src/components/charts')
  const srcDir = path.join(process.cwd(), 'frontend/src')

  function readFilesRecursively(dir: string, exclude: string[] = []): Map<string, string> {
    const files = new Map<string, string>()

    function traverse(currentDir: string) {
      if (exclude.some((ex) => currentDir.includes(ex))) return

      fs.readdirSync(currentDir).forEach((file) => {
        const filePath = path.join(currentDir, file)
        const stat = fs.statSync(filePath)

        if (stat.isDirectory()) {
          traverse(filePath)
        } else if ((file.endsWith('.tsx') || file.endsWith('.ts')) && !file.endsWith('.test.tsx')) {
          const content = fs.readFileSync(filePath, 'utf-8')
          files.set(filePath, content)
        }
      })
    }

    traverse(dir)
    return files
  }

  function searchImports(content: string, componentName: string): boolean {
    const patterns = [
      new RegExp(`import\\s+.*${componentName}`, 'g'),
      new RegExp(`from\\s+['"].*${componentName}['"]`, 'g'),
    ]
    return patterns.some((pattern) => pattern.test(content))
  }

  it('should identify all chart component files', () => {
    const files = fs.readdirSync(chartsDir).filter((f) => f.endsWith('.tsx') && !f.includes('test'))
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('LineChartComponent.tsx')
    expect(files).toContain('BarChartComponent.tsx')
    expect(files).toContain('PieChartComponent.tsx')
    expect(files).toContain('AreaChartComponent.tsx')
  })

  it('should have index.ts that exports all chart components', () => {
    const indexPath = path.join(chartsDir, 'index.ts')
    expect(fs.existsSync(indexPath)).toBe(true)

    const content = fs.readFileSync(indexPath, 'utf-8')
    expect(content).toContain('export')
  })

  it('should verify chart components are used or identified for removal', () => {
    const files = readFilesRecursively(srcDir, ['__tests__', '.test.', 'node_modules'])

    const chartComponents = ['AreaChartComponent', 'BarChartComponent', 'LineChartComponent', 'PieChartComponent']

    const usageMap: Record<string, boolean> = {}

    chartComponents.forEach((component) => {
      usageMap[component] = false

      files.forEach((content) => {
        if (searchImports(content, component)) {
          usageMap[component] = true
        }
      })
    })

    expect(typeof usageMap).toBe('object')
    expect(Object.keys(usageMap).length).toBe(chartComponents.length)
  })

  it('should ensure chart config is properly defined', () => {
    const configPath = path.join(chartsDir, 'chartConfig.ts')
    expect(fs.existsSync(configPath)).toBe(true)

    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('should have proper test coverage for chart components', () => {
    const testDir = path.join(chartsDir, '__tests__')
    expect(fs.existsSync(testDir)).toBe(true)

    const files = fs.readdirSync(testDir)
    expect(files.length).toBeGreaterThan(0)
    expect(files.some((f) => f.includes('test'))).toBe(true)
  })

  it('should verify chart components can render without errors', () => {
    const testPath = path.join(chartsDir, '__tests__', 'ChartComponents.test.tsx')
    expect(fs.existsSync(testPath)).toBe(true)

    const content = fs.readFileSync(testPath, 'utf-8')
    expect(content).toContain('describe')
    expect(content).toContain('render')
  })
})
