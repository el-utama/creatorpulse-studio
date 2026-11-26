import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'ui-engine.spec.mjs',outputDir:'engine-test-results/playwright',
 workers:1,retries:0,reporter:'list',
 use:{baseURL:'http://localhost:3000',headless:true},
 projects:[{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}],
 webServer:{command:'node --import ./tests/mock-tiktok.mjs ./node_modules/next/dist/bin/next start --port 3000',url:'http://localhost:3000',timeout:60000,reuseExistingServer:false}
});
