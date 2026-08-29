import { test, expect } from '@playwright/test';

test.describe('Admin Dispute Resolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token');
      localStorage.setItem('user_role', 'admin');
    });
  });

  test('should display disputes with correct initial state', async ({ page }) => {
    await page.goto('/admin');
    await page.click('text=Disputes');

    await expect(page.locator('text=Dispute #1')).toBeVisible();
    await expect(page.locator('text=Dispute #2')).toBeVisible();
    await expect(page.locator('text=Dispute #3')).toBeVisible();

    const openBadges = page.locator('text=open');
    expect(await openBadges.count()).toBeGreaterThanOrEqual(2);

    const resolvedBadges = page.locator('text=resolved');
    expect(await resolvedBadges.count()).toBeGreaterThanOrEqual(1);
  });

  test('should filter disputes by status', async ({ page }) => {
    await page.goto('/admin');
    await page.click('text=Disputes');

    await page.click('button:has-text("open")');
    await expect(page.locator('text=Dispute #1')).toBeVisible();
    await expect(page.locator('text=Dispute #2')).toBeVisible();
    await expect(page.locator('text=Dispute #3')).not.toBeVisible();

    await page.click('button:has-text("resolved")');
    await expect(page.locator('text=Dispute #3')).toBeVisible();
    await expect(page.locator('text=Dispute #1')).not.toBeVisible();

    await page.click('button:has-text("all")');
    await expect(page.locator('text=Dispute #1')).toBeVisible();
    await expect(page.locator('text=Dispute #3')).toBeVisible();
  });

  test('should resolve an open dispute and verify UI reflects resolved state', async ({ page }) => {
    await page.goto('/admin');
    await page.click('text=Disputes');

    await page.click('button:has-text("open")');
    await expect(page.locator('text=Dispute #1')).toBeVisible();

    await page.locator('text=Dispute #1').locator('..').locator('button:has-text("Resolve")').click();

    await page.click('button:has-text("all")');
    const dispute1Status = page.locator('text=Dispute #1').locator('..').locator('text=resolved');
    await expect(dispute1Status).toBeVisible();

    await page.click('button:has-text("open")');
    await expect(page.locator('text=Dispute #1')).not.toBeVisible();
  });

  test('should dismiss an open dispute and verify UI reflects dismissed state', async ({ page }) => {
    await page.goto('/admin');
    await page.click('text=Disputes');

    await page.click('button:has-text("open")');
    await expect(page.locator('text=Dispute #2')).toBeVisible();

    await page.locator('text=Dispute #2').locator('..').locator('button:has-text("Dismiss")').click();

    await page.click('button:has-text("all")');
    const dispute2Status = page.locator('text=Dispute #2').locator('..').locator('text=dismissed');
    await expect(dispute2Status).toBeVisible();
  });

  test('should complete full dispute lifecycle: create, review, resolve, verify', async ({ page }) => {
    await page.goto('/admin');
    await page.click('text=Disputes');

    await expect(page.locator('text=Dispute #1')).toBeVisible();
    await expect(page.locator('text=Weight reported does not match actual')).toBeVisible();

    await expect(page.locator('text=Reporter: GABC...1234')).toBeVisible();

    await page.locator('text=Dispute #1').locator('..').locator('button:has-text("Resolve")').click();

    await page.click('button:has-text("all")');
    const dispute1Status = page.locator('text=Dispute #1').locator('..').locator('text=resolved');
    await expect(dispute1Status).toBeVisible();

    await page.locator('text=Dispute #1').locator('..').locator('button:has-text("Resolve")').count().then(
      (count) => expect(count).toBe(0)
    );
  });

  test('resolved disputes should not show resolve/dismiss buttons', async ({ page }) => {
    await page.goto('/admin');
    await page.click('text=Disputes');

    const dispute3 = page.locator('text=Dispute #3').locator('..');
    await expect(dispute3.locator('button:has-text("Resolve")')).not.toBeVisible();
    await expect(dispute3.locator('button:has-text("Dismiss")')).not.toBeVisible();
  });
});
