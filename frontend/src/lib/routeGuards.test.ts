import { describe, it, expect, beforeEach } from 'vitest'

interface ProtectedRoute {
  path: string
  requiresAuth: boolean
  roles?: string[]
}

interface RouteGuardContext {
  isAuthenticated: boolean
  userRole?: string
}

// Route guard implementations
const canActivateRoute = (route: ProtectedRoute, context: RouteGuardContext): boolean => {
  if (!route.requiresAuth) {
    return true
  }

  if (!context.isAuthenticated) {
    return false
  }

  if (route.roles && route.roles.length > 0) {
    return route.roles.includes(context.userRole || '')
  }

  return true
}

const routes: ProtectedRoute[] = [
  { path: '/home', requiresAuth: false },
  { path: '/login', requiresAuth: false },
  { path: '/dashboard', requiresAuth: true },
  { path: '/admin', requiresAuth: true, roles: ['admin'] },
  { path: '/settings', requiresAuth: true, roles: ['user', 'admin'] }
]

describe('Route Guards', () => {
  let context: RouteGuardContext

  beforeEach(() => {
    context = { isAuthenticated: false, userRole: undefined }
  })

  describe('canActivateRoute', () => {
    it('should allow access to public routes without authentication', () => {
      const homeRoute = routes.find((r) => r.path === '/home')
      expect(homeRoute).toBeDefined()
      expect(canActivateRoute(homeRoute!, context)).toBe(true)
    })

    it('should deny access to protected routes without authentication', () => {
      const dashboardRoute = routes.find((r) => r.path === '/dashboard')
      expect(dashboardRoute).toBeDefined()
      expect(canActivateRoute(dashboardRoute!, context)).toBe(false)
    })

    it('should allow access to protected routes when authenticated', () => {
      const dashboardRoute = routes.find((r) => r.path === '/dashboard')
      context.isAuthenticated = true
      expect(dashboardRoute).toBeDefined()
      expect(canActivateRoute(dashboardRoute!, context)).toBe(true)
    })

    it('should deny access to role-restricted routes without proper role', () => {
      const adminRoute = routes.find((r) => r.path === '/admin')
      context.isAuthenticated = true
      context.userRole = 'user'
      expect(adminRoute).toBeDefined()
      expect(canActivateRoute(adminRoute!, context)).toBe(false)
    })

    it('should allow access to role-restricted routes with proper role', () => {
      const adminRoute = routes.find((r) => r.path === '/admin')
      context.isAuthenticated = true
      context.userRole = 'admin'
      expect(adminRoute).toBeDefined()
      expect(canActivateRoute(adminRoute!, context)).toBe(true)
    })

    it('should allow access to multi-role routes with matching role', () => {
      const settingsRoute = routes.find((r) => r.path === '/settings')
      context.isAuthenticated = true
      context.userRole = 'user'
      expect(settingsRoute).toBeDefined()
      expect(canActivateRoute(settingsRoute!, context)).toBe(true)
    })

    it('should deny access when authenticated but role does not match any allowed roles', () => {
      const settingsRoute = routes.find((r) => r.path === '/settings')
      context.isAuthenticated = true
      context.userRole = 'guest'
      expect(settingsRoute).toBeDefined()
      expect(canActivateRoute(settingsRoute!, context)).toBe(false)
    })
  })

  describe('Route Config', () => {
    it('should have home route as public', () => {
      const homeRoute = routes.find((r) => r.path === '/home')
      expect(homeRoute?.requiresAuth).toBe(false)
    })

    it('should have login route as public', () => {
      const loginRoute = routes.find((r) => r.path === '/login')
      expect(loginRoute?.requiresAuth).toBe(false)
    })

    it('should have dashboard route as protected', () => {
      const dashboardRoute = routes.find((r) => r.path === '/dashboard')
      expect(dashboardRoute?.requiresAuth).toBe(true)
      expect(dashboardRoute?.roles).toBeUndefined()
    })

    it('should have admin route with admin role requirement', () => {
      const adminRoute = routes.find((r) => r.path === '/admin')
      expect(adminRoute?.requiresAuth).toBe(true)
      expect(adminRoute?.roles).toContain('admin')
    })

    it('should have settings route with multiple allowed roles', () => {
      const settingsRoute = routes.find((r) => r.path === '/settings')
      expect(settingsRoute?.requiresAuth).toBe(true)
      expect(settingsRoute?.roles).toContain('user')
      expect(settingsRoute?.roles).toContain('admin')
    })

    it('should have all required routes defined', () => {
      expect(routes.length).toBeGreaterThan(0)
      const paths = routes.map((r) => r.path)
      expect(paths).toContain('/home')
      expect(paths).toContain('/login')
      expect(paths).toContain('/dashboard')
    })
  })

  describe('Route Guard Edge Cases', () => {
    it('should handle undefined user role gracefully', () => {
      const adminRoute = routes.find((r) => r.path === '/admin')
      context.isAuthenticated = true
      context.userRole = undefined
      expect(adminRoute).toBeDefined()
      expect(canActivateRoute(adminRoute!, context)).toBe(false)
    })

    it('should handle empty roles array', () => {
      const testRoute: ProtectedRoute = {
        path: '/test',
        requiresAuth: true,
        roles: []
      }
      context.isAuthenticated = true
      context.userRole = 'admin'
      expect(canActivateRoute(testRoute, context)).toBe(true)
    })

    it('should handle null context gracefully', () => {
      const publicRoute = routes.find((r) => r.path === '/home')
      const nullContext: RouteGuardContext = { isAuthenticated: false }
      expect(publicRoute).toBeDefined()
      expect(canActivateRoute(publicRoute!, nullContext)).toBe(true)
    })
  })
})
