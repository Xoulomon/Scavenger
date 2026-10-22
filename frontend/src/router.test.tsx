import { describe, expect, it } from 'vitest'
import { PROTECTED_ROUTES, router } from '@/router'

const LAZY_TYPE = Symbol.for('react.lazy')

const isLazyElement = (element: unknown) =>
  typeof element === 'object' &&
  element !== null &&
  (element as { type?: { $$typeof?: symbol } }).type?.$$typeof === LAZY_TYPE

describe('router code splitting', () => {
  it('lazy-loads non-critical protected pages', () => {
    const lazyPaths = PROTECTED_ROUTES.filter((route) => isLazyElement(route.element)).map(
      (route) => route.path
    )

    expect(lazyPaths).toEqual(
      expect.arrayContaining(['analytics', 'performance', 'feature-flags', 'test-reports'])
    )
  })

  it('keeps the login and not-found pages eagerly imported', () => {
    const loginRoute = router.routes.find((route) => route.path === '/login')
    const notFoundRoute = router.routes.find((route) => route.path === '*')

    expect(isLazyElement(loginRoute?.element)).toBe(false)
    expect(isLazyElement(notFoundRoute?.element)).toBe(false)
  })

  it('does not lazy-load the auth guard layout', () => {
    const guardRoute = router.routes.find((route) => route.children !== undefined)

    expect(guardRoute).toBeDefined()
    expect(isLazyElement(guardRoute?.element)).toBe(false)
  })
})
