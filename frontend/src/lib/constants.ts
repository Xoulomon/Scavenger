/**
 * Shared typed constants for the frontend.
 *
 * Replaces magic strings for routes, roles, waste types, and statuses with
 * `as const` objects and derived union types. Import these instead of using
 * string literals so that typos are caught at compile time and values can be
 * changed in a single place.
 */

/* -------------------------------------------------------------------------- */
/*                                   Routes                                   */
/* -------------------------------------------------------------------------- */

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  WASTE: '/waste',
  WASTE_CREATE: '/waste/create',
  WASTE_DETAIL: '/waste/:id',
  WASTE_EDIT: '/waste/:id/edit',
  COLLECTION: '/collection',
  COLLECTION_SCHEDULE: '/collection/schedule',
  COLLECTION_HISTORY: '/collection/history',
  REPORTS: '/reports',
  ANALYTICS: '/analytics',
  USERS: '/users',
  USER_DETAIL: '/users/:id',
  ADMIN: '/admin',
  NOT_FOUND: '/404'
} as const

export type Route = (typeof ROUTES)[keyof typeof ROUTES]

/**
 * Build a concrete path from a route template by replacing `:param`
 * placeholders with the provided values.
 *
 * @example
 * buildRoute(ROUTES.WASTE_DETAIL, { id: '42' }); // '/waste/42'
 */
export function buildRoute(
  route: Route | string,
  params: Record<string, string | number> = {}
): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, String(value)),
    route
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Roles                                    */
/* -------------------------------------------------------------------------- */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  COLLECTOR: 'collector',
  CITIZEN: 'citizen',
  USER: 'user'
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/* -------------------------------------------------------------------------- */
/*                                Waste types                                 */
/* -------------------------------------------------------------------------- */

export const WASTE_TYPES = {
  ORGANIC: 'organic',
  RECYCLABLE: 'recyclable',
  HAZARDOUS: 'hazardous',
  ELECTRONIC: 'electronic',
  GENERAL: 'general',
  CONSTRUCTION: 'construction'
} as const

export type WasteType = (typeof WASTE_TYPES)[keyof typeof WASTE_TYPES]

/* -------------------------------------------------------------------------- */
/*                                  Statuses                                  */
/* -------------------------------------------------------------------------- */

export const STATUSES = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const

export type Status = (typeof STATUSES)[keyof typeof STATUSES]

/* -------------------------------------------------------------------------- */
/*                              Derived helpers                               */
/* -------------------------------------------------------------------------- */

export const ROLE_VALUES: readonly Role[] = Object.values(ROLES)
export const WASTE_TYPE_VALUES: readonly WasteType[] = Object.values(WASTE_TYPES)
export const STATUS_VALUES: readonly Status[] = Object.values(STATUSES)

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_VALUES as readonly string[]).includes(value)
}

export function isWasteType(value: unknown): value is WasteType {
  return typeof value === 'string' && (WASTE_TYPE_VALUES as readonly string[]).includes(value)
}

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUS_VALUES as readonly string[]).includes(value)
}
