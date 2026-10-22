/**
 * @deprecated This file has been moved to `packages/shared/src/errors.ts`.
 *
 * This re-export shim exists only to avoid breaking the one test that
 * imports from the old location while the import site is updated.
 *
 * Update your imports to:
 *   import { ... } from '../../packages/shared/src/errors';
 *   // or, once the package is published:
 *   import { ... } from '@scavngr/shared';
 */
export * from '../../packages/shared/src/errors';
