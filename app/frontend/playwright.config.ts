import { defineConfig } from '@playwright/test';
const python = process.platform === 'win32' ? '"../backend/.venv/Scripts/python.exe"' : '../backend/.venv/bin/python';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined), viewport: { width: 1440, height: 1050 }, trace: 'retain-on-failure' },
  webServer: [
    { command: `${python} -m uvicorn zurikatos.api:app --app-dir ../backend/src --host 127.0.0.1 --port 8001`, url: 'http://127.0.0.1:8001/api/health', env: { OPERATOR_TOKEN: 'e2e-test-only-token' }, reuseExistingServer: false },
    { command: 'npm run dev -- --port 5174 --bypass-lock', url: 'http://127.0.0.1:5174', env: { API_PROXY_TARGET: 'http://127.0.0.1:8001' }, reuseExistingServer: false },
  ],
});
