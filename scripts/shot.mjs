import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [file, out, mode = 'light'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 900, height: 1400 },
  deviceScaleFactor: 2,
  colorScheme: mode,
});
await page.goto(pathToFileURL(resolve(file)).href);
if (process.env.AT) {
  await page.locator(process.env.AT).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
}
if (process.env.EXPAND) await page.locator(process.env.EXPAND).first().click();
await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
await browser.close();
