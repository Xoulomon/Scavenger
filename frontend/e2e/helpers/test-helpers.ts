/**
 * #963 – Backwards-compatibility re-export shim.
 *
 * All classes and helpers previously defined in this file now live in
 * `../test-utils`.  Existing specs that import from this path continue to
 * work without changes.
 *
 * Prefer importing directly from `../test-utils` in new tests.
 */

export {
  TestHelpers,
  TestDataFactory,
  PerformanceHelpers,
  VisualRegressionHelpers,
  fillWasteForm,
  fillRegistrationForm,
  assertVisible,
  assertTextContains,
  takeScreenshot,
  waitForApiResponse,
  navigateTo,
  collectConsoleErrors,
  mockGeolocation,
  mockDateTime,
  verifyTableHasRows,
  waitForLoadingComplete,
  waitForTransaction,
  verifyNotification,
  downloadFile,
  tabThrough,
  measurePageLoad,
  measureRenderTime,
  getMemoryUsage
} from '../test-utils'
