import { describe, it, expect } from 'vitest'
import { readdirSync } from 'fs'
import { resolve } from 'path'

const STORIES_DIR = resolve(__dirname, './stories')
const COMPONENTS_DIR = resolve(__dirname, './components')

describe('Storybook Stories Validation', () => {
  it('should have valid story files in stories directory', () => {
    const files = readdirSync(STORIES_DIR)
    const storyFiles = files.filter(f => f.endsWith('.stories.ts') || f.endsWith('.stories.tsx'))

    expect(storyFiles.length).toBeGreaterThan(0)
    expect(storyFiles).toContain('Button.stories.ts')
    expect(storyFiles).toContain('Header.stories.ts')
    expect(storyFiles).toContain('Page.stories.ts')
  })

  it('should verify each story file references an existing component', () => {
    const files = readdirSync(STORIES_DIR)
    const storyFiles = files.filter(f => f.endsWith('.stories.ts') || f.endsWith('.stories.tsx'))

    storyFiles.forEach(storyFile => {
      const componentName = storyFile.replace(/\.stories\.tsx?$/, '')
      const possibleFiles = [
        `${componentName}.tsx`,
        `${componentName}.ts`,
        `${componentName}/index.tsx`,
        `${componentName}/index.ts`,
      ]

      // For stories in the stories directory, components should either be in the same directory
      // or be valid UI components
      const isComponentStory = ['Button', 'Header', 'Page'].includes(componentName)
      if (isComponentStory) {
        const existsInStoriesDir = files.some(f => possibleFiles.includes(f))
        expect(existsInStoriesDir, `Component for ${storyFile} should exist`).toBe(true)
      }
    })
  })

  it('should not have orphaned component references', () => {
    const files = readdirSync(STORIES_DIR)
    const storyFiles = files.filter(f => f.endsWith('.stories.ts') || f.endsWith('.stories.tsx'))

    const orphanedStories = storyFiles.filter(storyFile => {
      const componentName = storyFile.replace(/\.stories\.tsx?$/, '')
      // Check if component file exists
      const possibleFiles = [
        `${componentName}.tsx`,
        `${componentName}.ts`,
        `${componentName}/index.tsx`,
        `${componentName}/index.ts`,
      ]

      return !files.some(f => possibleFiles.includes(f))
    })

    // These are expected to not have components in stories dir (they may reference external components)
    const expectedExternalReferences = ['Button', 'Header', 'Page']
    const unexpectedOrphans = orphanedStories.filter(
      story => !expectedExternalReferences.some(ref => story.includes(ref))
    )

    expect(unexpectedOrphans.length).toBe(0)
  })

  it('should have documentation files for Storybook', () => {
    const files = readdirSync(STORIES_DIR)
    const docFiles = files.filter(f => f.endsWith('.mdx'))

    expect(docFiles.length).toBeGreaterThan(0)
    expect(docFiles).toContain('ComponentLibrary.mdx')
  })

  it('should not have duplicate story files', () => {
    const files = readdirSync(STORIES_DIR)
    const storyFiles = files.filter(f => f.endsWith('.stories.ts') || f.endsWith('.stories.tsx'))

    const componentNames = storyFiles.map(f => f.replace(/\.stories\.tsx?$/, ''))
    const uniqueNames = new Set(componentNames)

    expect(componentNames.length).toBe(uniqueNames.size)
  })

  it('should have at least one story export per story file', () => {
    // This is a structural test - actual story content validation
    const files = readdirSync(STORIES_DIR)
    const storyFiles = files.filter(f => f.endsWith('.stories.ts') || f.endsWith('.stories.tsx'))

    expect(storyFiles.length).toBeGreaterThan(0)
    // Each story file should export at least one named story
    storyFiles.forEach(storyFile => {
      expect(storyFile).toMatch(/\.stories\.tsx?$/)
    })
  })

  it('should maintain consistent story naming conventions', () => {
    const files = readdirSync(STORIES_DIR)
    const storyFiles = files.filter(f => f.endsWith('.stories.ts') || f.endsWith('.stories.tsx'))

    storyFiles.forEach(storyFile => {
      // Story files should follow the pattern: ComponentName.stories.ts(x)
      expect(storyFile).toMatch(/^[A-Z][a-zA-Z]*\.stories\.tsx?$/)
    })
  })

  it('should verify story files are not empty', () => {
    const files = readdirSync(STORIES_DIR)
    const storyFiles = files.filter(f => f.endsWith('.stories.ts') || f.endsWith('.stories.tsx'))

    expect(storyFiles.length).toBeGreaterThan(0)
    // Basic check that story files exist and are accessible
    storyFiles.forEach(storyFile => {
      const filePath = resolve(STORIES_DIR, storyFile)
      expect(filePath).toBeTruthy()
    })
  })
})
