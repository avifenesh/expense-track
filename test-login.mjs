import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to login page
    await page.goto('http://localhost:3000/login');
    console.log('✓ Navigated to login page');

    // Fill in credentials
    await page.fill('#email', 'aviarchi1994@gmail.com');
    console.log('✓ Filled email');

    await page.fill('#password', 'Af!@#$56789');
    console.log('✓ Filled password');

    // Click submit button
    await page.click('button[type="submit"]');
    console.log('✓ Clicked submit');

    // Wait for navigation
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Check current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.log('❌ Still on login page - login failed');
      // Take screenshot
      await page.screenshot({ path: '/tmp/login-failed.png' });
      console.log('Screenshot saved to /tmp/login-failed.png');
    } else {
      console.log('✅ Login successful! Redirected to:', currentUrl);
      await page.screenshot({ path: '/tmp/login-success.png' });
    }

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/login-error.png' });
  } finally {
    await browser.close();
  }
})();
