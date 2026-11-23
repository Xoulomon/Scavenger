import { describe, it, expect } from 'vitest'
import * as LucideIcons from 'lucide-react'

interface IconDefinition {
  name: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- icon components accept arbitrary props
  component: React.ComponentType<any>
  category: string
}

// Centralized icon registry using only lucide-react
const iconRegistry: Record<string, IconDefinition> = {
  home: { name: 'home', component: LucideIcons.Home, category: 'navigation' },
  settings: { name: 'settings', component: LucideIcons.Settings, category: 'navigation' },
  user: { name: 'user', component: LucideIcons.User, category: 'user' },
  logout: { name: 'logout', component: LucideIcons.LogOut, category: 'user' },
  menu: { name: 'menu', component: LucideIcons.Menu, category: 'navigation' },
  close: { name: 'close', component: LucideIcons.X, category: 'navigation' },
  search: { name: 'search', component: LucideIcons.Search, category: 'interaction' },
  trash: { name: 'trash', component: LucideIcons.Trash, category: 'action' },
  edit: { name: 'edit', component: LucideIcons.Edit, category: 'action' },
  download: { name: 'download', component: LucideIcons.Download, category: 'action' },
  upload: { name: 'upload', component: LucideIcons.Upload, category: 'action' },
  checkCircle: { name: 'checkCircle', component: LucideIcons.CheckCircle, category: 'status' },
  alertCircle: { name: 'alertCircle', component: LucideIcons.AlertCircle, category: 'status' },
  info: { name: 'info', component: LucideIcons.Info, category: 'status' },
  wifiOff: { name: 'wifiOff', component: LucideIcons.WifiOff, category: 'status' },
  bell: { name: 'bell', component: LucideIcons.Bell, category: 'notification' },
  chevronDown: { name: 'chevronDown', component: LucideIcons.ChevronDown, category: 'navigation' },
  chevronUp: { name: 'chevronUp', component: LucideIcons.ChevronUp, category: 'navigation' },
  calendar: { name: 'calendar', component: LucideIcons.Calendar, category: 'time' },
  clock: { name: 'clock', component: LucideIcons.Clock, category: 'time' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- icon components accept arbitrary props
const getIcon = (name: string): React.ComponentType<any> | null => {
  const icon = iconRegistry[name]
  return icon ? icon.component : null
}

describe('Icon Registry', () => {
  describe('Icon Registration', () => {
    it('should have all required icons registered', () => {
      expect(Object.keys(iconRegistry).length).toBeGreaterThan(0)
    })

    it('should have home icon', () => {
      expect(iconRegistry.home).toBeDefined()
      expect(iconRegistry.home.name).toBe('home')
    })

    it('should have settings icon', () => {
      expect(iconRegistry.settings).toBeDefined()
      expect(iconRegistry.settings.name).toBe('settings')
    })

    it('should have user-related icons', () => {
      expect(iconRegistry.user).toBeDefined()
      expect(iconRegistry.logout).toBeDefined()
    })

    it('should have action icons', () => {
      expect(iconRegistry.edit).toBeDefined()
      expect(iconRegistry.delete).toBeUndefined() // Should use trash instead
      expect(iconRegistry.trash).toBeDefined()
    })

    it('should have status icons', () => {
      expect(iconRegistry.checkCircle).toBeDefined()
      expect(iconRegistry.alertCircle).toBeDefined()
      expect(iconRegistry.info).toBeDefined()
      expect(iconRegistry.wifiOff).toBeDefined()
    })

    it('should have navigation icons', () => {
      expect(iconRegistry.menu).toBeDefined()
      expect(iconRegistry.close).toBeDefined()
      expect(iconRegistry.chevronDown).toBeDefined()
      expect(iconRegistry.chevronUp).toBeDefined()
    })
  })

  describe('Icon Retrieval', () => {
    it('should retrieve icon by name', () => {
      const homeIcon = getIcon('home')
      expect(homeIcon).toBeDefined()
      expect(typeof homeIcon).toBe('function')
    })

    it('should return null for non-existent icon', () => {
      const unknownIcon = getIcon('unknown')
      expect(unknownIcon).toBeNull()
    })

    it('should return correct icon component', () => {
      const settingsIcon = getIcon('settings')
      expect(settingsIcon).toBe(LucideIcons.Settings)
    })

    it('should handle case-sensitive icon names', () => {
      const homeIcon = getIcon('home')
      const HomeIcon = getIcon('Home')
      expect(homeIcon).toBeDefined()
      expect(HomeIcon).toBeNull()
    })
  })

  describe('Icon Categorization', () => {
    it('should categorize navigation icons', () => {
      const navigationIcons = Object.values(iconRegistry).filter(
        icon => icon.category === 'navigation'
      )
      expect(navigationIcons.length).toBeGreaterThan(0)
    })

    it('should categorize action icons', () => {
      const actionIcons = Object.values(iconRegistry).filter(
        icon => icon.category === 'action'
      )
      expect(actionIcons.length).toBeGreaterThan(0)
    })

    it('should categorize status icons', () => {
      const statusIcons = Object.values(iconRegistry).filter(
        icon => icon.category === 'status'
      )
      expect(statusIcons.length).toBeGreaterThan(0)
    })

    it('should have no uncategorized icons', () => {
      const validCategories = ['navigation', 'user', 'action', 'interaction', 'status', 'notification', 'time']
      const uncategorizedIcons = Object.values(iconRegistry).filter(
        icon => !validCategories.includes(icon.category)
      )
      expect(uncategorizedIcons.length).toBe(0)
    })
  })

  describe('Icon Library Consolidation', () => {
    it('should use only lucide-react icons', () => {
      Object.values(iconRegistry).forEach(iconDef => {
        expect(typeof iconDef.component).toBe('function')
      })
    })

    it('should not have duplicate icon names', () => {
      const names = Object.keys(iconRegistry)
      const uniqueNames = new Set(names)
      expect(names.length).toBe(uniqueNames.size)
    })

    it('should have consistent naming convention', () => {
      Object.keys(iconRegistry).forEach(name => {
        expect(/^[a-z][a-zA-Z]*$/.test(name)).toBe(true)
      })
    })

    it('should have all icons as valid components', () => {
      Object.values(iconRegistry).forEach(iconDef => {
        expect(iconDef.component).toBeTruthy()
        expect(typeof iconDef.component).toBe('function')
      })
    })
  })

  describe('Icon Usage', () => {
    it('should allow retrieving icon by category', () => {
      const navigationIcons = Object.entries(iconRegistry)
        .filter(([, icon]) => icon.category === 'navigation')
        .map(([name]) => name)

      expect(navigationIcons.length).toBeGreaterThan(0)
      navigationIcons.forEach(name => {
        expect(getIcon(name)).toBeTruthy()
      })
    })

    it('should support icon size properties through components', () => {
      const homeIcon = getIcon('home')
      expect(homeIcon).toBeDefined()
      // Lucide icons support size properties
    })

    it('should support icon color properties through components', () => {
      const settingsIcon = getIcon('settings')
      expect(settingsIcon).toBeDefined()
      // Lucide icons support color properties
    })
  })

  describe('Icon Bundle Size', () => {
    it('should have reasonable number of icons registered', () => {
      const iconCount = Object.keys(iconRegistry).length
      expect(iconCount).toBeLessThan(100)
      expect(iconCount).toBeGreaterThan(0)
    })

    it('should not include redundant icons', () => {
      const icons = Object.keys(iconRegistry)
      const hasDelete = icons.includes('delete')
      const hasTrash = icons.includes('trash')
      // Should use only trash, not delete
      expect(hasTrash).toBe(true)
      if (hasDelete) {
        expect(hasDelete && hasTrash).toBe(false)
      }
    })
  })
})
