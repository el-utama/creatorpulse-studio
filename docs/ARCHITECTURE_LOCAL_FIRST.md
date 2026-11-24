# CreatorPulse V3 — accepted architecture (2026-11-24)
Decision: Hermes-first, local-first, no required n8n, no Redis cloud, maximum three accounts. Supersedes cloud storage plans in AGENT_GATEWAY_V3.md.
## Responsibility
- Vercel: existing TikTok OAuth callback and client secret, human dashboard, authorized REST/MCP facade, stateless token encryption/decryption and official TikTok API operations. No durable account data stored at Vercel; environment secrets are retained there.
- Hermes host: SQLite Local Bridge process, encrypted OAuth token records, durable publication states and audit events, trend observations and shared manual idempotency. Hermes handles AI research, chat, scheduling, media coordination; its model gets only restricted agent bearer credential. SQLite is not Hermes's own memory database.
- Bridge: restricted authenticated storage RPC (fixed operations, no arbitrary SQL, Redis or Lua execution), loopback listener; TLS reverse proxy or private authenticated tunnel permits Vercel to reach /storage/v1. Never expose plain HTTP over the public internet.
- Token handling: Vercel currently performs OAuth and TikTok API requests, and sends AES-GCM sealed records to local storage. It retains the encryption key and can decrypt in memory. TikTok tokens and the bridge/operator keys are never sent to the model. This is a local-storage architecture, not yet a fully local TikTok execution service.
- Human approval: dashboard or trusted out-of-band callback; agent has no approval tool. Both inbox and Direct Post require human review. Inbox must be completed in TikTok. Direct Post requires explicit final settings, duration and preview; unaudited applications remain SELF_ONLY on private accounts. No autonomous posting.
## Data and availability
SQLite WAL, atomic CAS, persistent leases and idempotency. Bridge binds 127.0.0.1. Restrict filesystem access and isolate from the Hermes process/account as much as practical. Back up SQLite using its backup API (not a live copy of just the .sqlite3 file); separately back up vault key securely. On host/tunnel failure gateway operations fail closed. Unenrolled browser accounts retain manual functionality when gateway not configured; enrolled sessions depend on the bridge. The public gateway health configured flag only indicates environment completeness, not network reachability.
## Progress log
- V2 production: multi-account browser dashboard, 11 tests passed, main merge 9c61c217.
- V3 foundation: encrypted vault, restricted REST, trend evidence ingestion (97b7571, 9574ae9).
- V3 inbox queue and human approval: 549cb19, 882e73c, eeff041; CI 45430017425 success.
- MCP, OpenAPI, optional n8n: fbfdbd5, 51f5330; CI 45430725112 success.
- Hermes skill/config: a6588c2.
- Local-first SQLite storage: 8dc6f11; tests include real local HTTP bridge and persistence.
## Remaining gates
CI for latest revision, real HTTPS tunnel and environment installation, enrollment of real TikTok accounts, live Hermes MCP/chat and research tests. Trend data is sourced by agent, not automatically collected by CreatorPulse. No actual chat approval adapter for Hermes yet. No paid service or TikTok Developer settings changed. Existing production must not be represented as V3 until deployment verified. 

## Hermes onboarding and Hobby optimization
Added deterministic bootstrap, local stdio MCP adapter, a copyable instruction in the dashboard, and explicit tests for preserving the existing model and messaging settings. Local discovery/ping uses no remote invocation. Batched SQLite reads reduce account/queue fan-out to one request each. No new cron, LLM, video production, messaging webhook, or database on Vercel. Actual production usage not yet measured; gateway remains opt-in. See [onboarding](../integrations/hermes/ONBOARDING.md). Keep owner secrets isolated from agent process; do not authorize live posting during setup.
## V3.5 dual publication
Agent selects requested mode (inbox/profile), supplies real duration for profile; operator selects final caption, privacy, interactions, AI/commercial disclosures and consent. Fresh account capability checks run at review, approval and execution. Direct Post is restricted by the existing audit flag, never changed automatically. Terminal drafts can be archived, preserving encrypted records and UUIDs. See [repository audit](AUDIT_V3.md).
