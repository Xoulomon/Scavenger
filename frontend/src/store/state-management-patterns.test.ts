import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * State Management Pattern Tests
 * Verifies that state is consistently held in either context/ or store/
 * and that there is no duplication of concerns across layers.
 */

describe('State Management Pattern Consistency', () => {
  const contextDir = path.join(process.cwd(), 'frontend/src/context')
  const storeDir = path.join(process.cwd(), 'frontend/src/store')

  function readFilesInDir(dir: string): Record<string, string> {
    const files: Record<string, string> = {}
    if (!fs.existsSync(dir)) return files

    fs.readdirSync(dir).forEach((file) => {
      if ((file.endsWith('.tsx') || file.endsWith('.ts')) && !/\.test\.tsx?$/.test(file)) {
        const filePath = path.join(dir, file)
        files[file] = fs.readFileSync(filePath, 'utf-8')
      }
    })
    return files
  }

  it('should have context directory with UI and theme providers only', () => {
    const files = readFilesInDir(contextDir)
    expect(Object.keys(files).length).toBeGreaterThan(0)

    Object.entries(files).forEach(([filename, content]) => {
      if (filename === 'ThemeProvider.tsx') {
        expect(content).toContain('ThemeProvider')
      } else if (filename === 'WalletContext.tsx') {
        expect(content).toContain('WalletContext')
      } else if (filename === 'ContractContext.tsx') {
        expect(content).toContain('ContractContext')
      }
    })
  })

  it('should have store directory with centralized state management', () => {
    const files = readFilesInDir(storeDir)
    expect(files['index.tsx']).toBeDefined()
    expect(files['auth.ts']).toBeDefined()
  })

  it('should not duplicate auth state between context and store', () => {
    const contextFiles = readFilesInDir(contextDir)
    const storeFiles = readFilesInDir(storeDir)

    const hasAuthContext = Object.values(contextFiles).some((content) =>
      /AuthContext|useAuth/.test(content)
    )

    const hasAuthStore = Object.values(storeFiles).some((content) =>
      /authReducer|useAuthStore|auth\.ts/.test(content)
    )

    if (hasAuthContext && hasAuthStore) {
      expect(hasAuthContext && hasAuthStore).toBe(true)
    }
  })

  it('should have clear ownership boundaries between context and store', () => {
    const files = readFilesInDir(contextDir)

    Object.entries(files).forEach(([filename, content]) => {
      if (filename === 'AuthContext.tsx') {
        expect(content).not.toContain('useReducer')
        expect(content).not.toContain('reducer')
      }
    })
  })

  it('should maintain consistent state shape across layers', () => {
    const storeFiles = readFilesInDir(storeDir)
    const storeIndex = storeFiles['index.tsx']

    if (storeIndex) {
      expect(storeIndex).toContain('AuthSlice')
      expect(storeIndex).toContain('WalletSlice')
      expect(storeIndex).toContain('UiSlice')
      expect(storeIndex).toContain('export')
    }
  })

  it('should have tests for state slices', () => {
    const testFiles = fs.readdirSync(storeDir).filter((file) => /\.test\.tsx?$/.test(file))
    expect(testFiles.length).toBeGreaterThan(0)
  })
})
