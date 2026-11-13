import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:3002',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'go run ./server',
    url: 'http://127.0.0.1:3002/api/health',
    timeout: 120000,
    reuseExistingServer: false,
    env: { GOCACHE: path.resolve('.artifacts/go-cache'), PORT: '3002', HOST: '127.0.0.1' },
  },
});
