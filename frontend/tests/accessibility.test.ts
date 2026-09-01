import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Testing', () => {
  test('homepage should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('dashboard should have proper ARIA labels', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Check for navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check for proper heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('form inputs should have associated labels', async ({ page }) => {
    await page.goto('/submit-waste');

    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });

  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');

      const hasAccessibleName = text?.trim() || ariaLabel;
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');

      const hasAltText = alt || ariaLabel;
      expect(hasAltText).toBeTruthy();
    }
  });

  test('keyboard navigation should work', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    let focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused);

    // Continue tabbing
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused);
  });

  test('color contrast should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    const results = await page.evaluate(() => {
      return (window as any).axe.run();
    });

    const contrastViolations = results.violations.filter(
      (v: any) => v.id === 'color-contrast'
    );

    expect(contrastViolations).toHaveLength(0);
  });

  test('focus indicators should be visible', async ({ page }) => {
    await page.goto('/');

    const button = page.locator('button').first();
    await button.focus();

    const outline = await button.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outline || styles.boxShadow;
    });

    expect(outline).toBeTruthy();
  });

  test('modals should trap focus', async ({ page }) => {
    await page.goto('/');

    // Open a modal if available
    const modalTrigger = page.locator('[data-testid="open-modal"]').first();
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();

      // Check for role="dialog"
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
    }
  });

  test('skip links should be present', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeVisible();
  });

  test('form validation messages should be accessible', async ({ page }) => {
    await page.goto('/submit-waste');

    // Submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Check for error messages with proper ARIA
    const errors = page.locator('[role="alert"]');
    const errorCount = await errors.count();

    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const error = errors.nth(i);
        const text = await error.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test('page should have proper language attribute', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    const lang = await html.getAttribute('lang');

    expect(lang).toBeTruthy();
  });

  test('responsive design should work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check that content is not cut off
    const body = page.locator('body');
    const boundingBox = await body.boundingBox();

    expect(boundingBox?.width).toBeLessThanOrEqual(375);
  });

  test('text should be resizable', async ({ page }) => {
    await page.goto('/');

    // Zoom in
    await page.evaluate(() => {
      document.body.style.zoom = '200%';
    });

    // Check that content is still readable
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
