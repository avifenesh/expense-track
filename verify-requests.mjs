import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login');
    
    // Login as Avi (User 1)
    await page.fill('input[name="email"]', 'user1@example.com');
    await page.fill('input[name="password"]', 'Af!@#$56789');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000');
    console.log('Logged in as Avi');

    // Go to Transactions tab
    await page.click('button:has-text("Transactions")');
    console.log('Navigated to Transactions tab');

    // Create a Request
    console.log('Creating a transaction request...');
    await page.selectOption('select[name="accountId"]', { label: 'Avi' }); // Ensure Avi's account is selected
    await page.fill('input[name="amount"]', '75.50');
    await page.fill('input[name="date"]', '2026-01-15');
    await page.fill('textarea[name="description"]', 'Shared Dinner');
    // Check "Charge partner"
    await page.check('input[name="isRequest"]');
    await page.click('button[type="submit"]');
    
    // Verify success message
    await page.waitForSelector('p:has-text("Request sent to partner.")');
    console.log('Request sent successfully');

    // Logout
    await page.click('button:has-text("Sign out")');
    console.log('Logged out');

    // Login as Serena (User 2)
    await page.fill('input[name="email"]', 'user2@example.com');
    await page.fill('input[name="password"]', 'A76v38i61_7');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000');
    console.log('Logged in as Serena');

    // Go to Transactions tab
    await page.click('button:has-text("Transactions")');
    
    // Verify Request appears in Action Center
    await page.waitForSelector('div:has-text("Shared Dinner")');
    console.log('Request visible in Action Center');

    // Approve Request
    console.log('Approving request...');
    await page.click('button:has-text("Approve")');
    
    // Verify success message
    await page.waitForSelector('div:has-text("Request approved and logged.")');
    console.log('Request approved');

    // Verify Transaction logged
    await page.waitForSelector('div:has-text("Shared Dinner")'); // Should now be in the list
    console.log('Transaction logged successfully');

  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
