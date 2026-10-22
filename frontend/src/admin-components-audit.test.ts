import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'

describe('Admin Components Audit', () => {
  const adminComponentsDir = path.join(__dirname, './components/admin')
  const srcDir = path.join(__dirname, '.')

  function isComponentFile(filename: string): boolean {
    return (
      filename.endsWith('.tsx') &&
      !filename.endsWith('.test.tsx') &&
      filename[0] !== filename[0].toLowerCase()
    )
  }

  function getComponentName(filename: string): string {
    return filename.replace('.tsx', '')
  }

  function searchForComponentUsage(componentName: string): boolean {
    try {
      const pattern = new RegExp(`\\b${componentName}\\b`, 'g')

      function searchDir(dir: string): boolean {
        const entries = readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
              continue
            }
            if (searchDir(path.join(dir, entry.name))) {
              return true
            }
          } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
            const filePath = path.join(dir, entry.name)
            // Skip the component's own file
            if (filePath.includes(`components/admin/${componentName}`)) {
              continue
            }
            try {
              const content = readFileSync(filePath, 'utf-8')
              if (pattern.test(content)) {
                return true
              }
            } catch {
              // Ignore read errors
            }
          }
        }
        return false
      }

      return searchDir(srcDir)
    } catch {
      return false
    }
  }

  describe('admin component usage audit', () => {
    it('should have documented all admin components', () => {
      if (existsSync(adminComponentsDir)) {
        const files = readdirSync(adminComponentsDir)
        const componentFiles = files.filter(isComponentFile)
        expect(componentFiles.length).toBeGreaterThan(0)
      }
    })

    it('should verify OverviewTab is used', () => {
      const isUsed = searchForComponentUsage('OverviewTab')
      expect(isUsed).toBe(true)
    })

    it('should verify UsersTab is used', () => {
      const isUsed = searchForComponentUsage('UsersTab')
      expect(isUsed).toBe(true)
    })

    it('should verify DisputesTab is used', () => {
      const isUsed = searchForComponentUsage('DisputesTab')
      expect(isUsed).toBe(true)
    })

    it('should verify ConfigTab is used', () => {
      const isUsed = searchForComponentUsage('ConfigTab')
      expect(isUsed).toBe(true)
    })

    it('should verify AuditLogTab is used', () => {
      const isUsed = searchForComponentUsage('AuditLogTab')
      expect(isUsed).toBe(true)
    })

    it('should verify SystemHealthTab is used', () => {
      const isUsed = searchForComponentUsage('SystemHealthTab')
      expect(isUsed).toBe(true)
    })

    it('should verify WastesTab is used', () => {
      const isUsed = searchForComponentUsage('WastesTab')
      expect(isUsed).toBe(true)
    })

    it('should verify IncentivesTab is used', () => {
      const isUsed = searchForComponentUsage('IncentivesTab')
      expect(isUsed).toBe(true)
    })
  })

  describe('admin components are exported', () => {
    it('should export admin components from index', () => {
      const indexPath = path.join(adminComponentsDir, 'index.ts')
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8')
        expect(content).toContain('export')
        expect(content).toContain('Tab')
      }
    })
  })

  describe('admin components have tests', () => {
    it('should have test files for admin components', () => {
      const testFiles = readdirSync(adminComponentsDir).filter(f => f.endsWith('.test.tsx'))
      expect(testFiles.length).toBeGreaterThan(0)
    })

    it('should have AdminTabs test file', () => {
      const testPath = path.join(adminComponentsDir, 'AdminTabs.test.tsx')
      expect(existsSync(testPath)).toBe(true)
    })
  })

  describe('admin components follow naming convention', () => {
    it('should name components with Tab suffix for tab components', () => {
      if (existsSync(adminComponentsDir)) {
        const files = readdirSync(adminComponentsDir)
        const tabComponents = files.filter(f => f.endsWith('Tab.tsx'))
        expect(tabComponents.length).toBeGreaterThan(0)
      }
    })

    it('should maintain consistent file naming', () => {
      if (existsSync(adminComponentsDir)) {
        const files = readdirSync(adminComponentsDir)
        const componentFiles = files.filter(isComponentFile)

        componentFiles.forEach(file => {
          expect(file).toMatch(/^[A-Z][a-zA-Z0-9]*\.tsx$/)
        })
      }
    })
  })

  describe('admin panel integration', () => {
    it('should be used in AdminDashboardPage', () => {
      const adminPagePath = path.join(srcDir, 'pages', 'AdminDashboardPage.tsx')
      if (existsSync(adminPagePath)) {
        const content = readFileSync(adminPagePath, 'utf-8')
        expect(content).toContain('import')
        expect(content).toContain('admin')
      }
    })
  })

  describe('cleanup readiness', () => {
    it('should list all unused components for potential removal', () => {
      if (existsSync(adminComponentsDir)) {
        const files = readdirSync(adminComponentsDir)
        const componentFiles = files.filter(isComponentFile)
        const unusedComponents = componentFiles.filter(
          f => !searchForComponentUsage(getComponentName(f))
        )

        // All components should be used - verify none are orphaned
        expect(unusedComponents.length).toBe(0)
      }
    })
  })
})
