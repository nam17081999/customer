// @ts-ignore
import { chromium } from '/Users/nam/Desktop/customer/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:3000/orders', { waitUntil: 'networkidle' });
console.log('Title:', await page.title());
console.log('URL:', page.url());

// Check if redirected to login
const url = page.url();
if (url.includes('login')) {
  console.log('Redirected to login — try filling credentials...');
  // Look for email/phone input
  const inputs = await page.locator('input').all();
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const placeholder = await inp.getAttribute('placeholder');
    console.log('Input:', type, placeholder);
  }
}

await page.waitForTimeout(5000);
await browser.close();
