import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',
  use:{baseURL:'http://localhost:3000',headless:true},
  webServer:{command:'node --import ./tests/mock-tiktok.mjs ./node_modules/next/dist/bin/next start --port 3000',url:'http://localhost:3000',timeout:60000,reuseExistingServer:false},
  retries:0,
  reporter:'list'
});
