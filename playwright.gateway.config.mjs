import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'gateway.spec.mjs',use:{baseURL:'http://localhost:3000',headless:true},workers:1,
 webServer:{command:'node --import ./tests/mock-tiktok.mjs ./node_modules/next/dist/bin/next start --port 3000',url:'http://localhost:3000',timeout:60000,reuseExistingServer:false,
 env:{APP_URL:'http://localhost:3000',UPSTASH_REDIS_REST_URL:'https://mock-redis.invalid',UPSTASH_REDIS_REST_TOKEN:'mock-only',CREATORPULSE_VAULT_KEY:Buffer.alloc(32,7).toString('base64'),CREATORPULSE_OPERATOR_KEY:'o'.repeat(40),CREATORPULSE_AGENT_KEY:'a'.repeat(40)}}
});
