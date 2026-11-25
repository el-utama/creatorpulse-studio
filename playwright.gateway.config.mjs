import {defineConfig} from '@playwright/test';
export default defineConfig({
 outputDir:'gateway-test-results',testDir:'./tests',testMatch:'gateway.spec.mjs',use:{baseURL:'http://localhost:3000',headless:true},workers:1,
 webServer:[{command:'python3 local-bridge/bridge.py --db /tmp/creatorpulse-gateway-ci.sqlite3 --port 8765',port:8765,timeout:30000,reuseExistingServer:false,env:{CREATORPULSE_BRIDGE_TOKEN:'b'.repeat(40)}},{command:'node --import ./tests/mock-tiktok.mjs ./node_modules/next/dist/bin/next start --port 3000',url:'http://localhost:3000',timeout:60000,reuseExistingServer:false,
 env:{APP_URL:'http://localhost:3000',CREATORPULSE_BRIDGE_URL:'https://mock-local-bridge.invalid/storage/v1',CREATORPULSE_BRIDGE_TOKEN:'b'.repeat(40),CREATORPULSE_VAULT_KEY:Buffer.alloc(32,7).toString('base64'),CREATORPULSE_OPERATOR_KEY:'o'.repeat(40),CREATORPULSE_AGENT_KEY:'a'.repeat(40)}}]
});
