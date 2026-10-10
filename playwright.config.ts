import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:8086', launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run build:web && python3 -m http.server 8086 --directory dist', url: 'http://127.0.0.1:8086', reuseExistingServer: true, timeout: 120000 },
  projects: [{ name: 'mobile', use: { viewport: { width: 390, height: 844 } } }, { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }],
});
