# CreatorPulse Studio V3 — gateway foundation

**Historical design:** the Redis-cloud plan below is superseded by [local-first architecture](ARCHITECTURE_LOCAL_FIRST.md) and [Local Bridge setup](../local-bridge/README.md). API contracts and publication constraints remain applicable.
## Accepted scope
Single operator/workspace, maximum three separately authorized TikTok accounts. Human dashboard remains the control plane; n8n/Hermes/other agents use HTTPS API, later MCP. No changes to existing TikTok client key, secret, redirect URI or scopes. No paid service provisioned. This branch is a foundation, not a complete publishing platform.
## Storage decision
Reuse the optional Redis REST interface (Upstash-compatible) rather than introduce a new SQL driver or provider at this stage. Require a persistent store, AES-256-GCM encryption key and two separate high-entropy credentials. Agent credential reads accounts and records trend observations; operator credential additionally enrolls/disconnects accounts. No tokens exposed in responses. A separate signed HttpOnly cookie links the enrolled dashboard account to the same vault to avoid ordinary concurrent refresh rotation. Do not run multiple deployments with different vault encryption keys. This is a single-operator model, not a multi-tenant team system.
## Deployment prerequisites
UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (persistent Redis), CREATORPULSE_VAULT_KEY (32 random bytes base64), CREATORPULSE_OPERATOR_KEY and CREATORPULSE_AGENT_KEY (different random credentials, >=32 characters). Keep all server-only. Use environment configuration, never send secrets in chat or put them in workflow JSON. Without all five, gateway returns 503; existing dashboard unaffected. Do not activate live gateway until storage/credential setup, encrypted vault tests and real authorization are verified. 
## API v1
- GET /api/gateway/v1/health: configuration status, no secrets.
- GET /api/gateway/v1/accounts: list gateway-enabled accounts (opaque IDs).
- POST /api/gateway/v1/enroll: operator bearer + active dashboard session, moves active account from cookies to vault. The dashboard Integration AI Agent panel exposes this operation when configured. Operator credential is not persisted in the browser. Existing legacy session must reconnect to obtain a slot.
- POST /api/gateway/v1/accounts/{id}/disconnect: operator only; delete vault record. Does not revoke authorization on TikTok itself.
- GET /api/gateway/v1/accounts/{id}/analytics, /videos?cursor=, /capabilities
- POST /api/gateway/v1/trends: ingest structured source observation. GET /api/gateway/v1/trends?region=ID&days=7.
## Trend intelligence
Agent researches TikTok Creative Center, authorized Discovery API (requires separate access), web and Google Trends. Submit topic/type/region/source/sourceUrl/observedAt/evidence; optional changePct and metric definition. Evidence is agent-supplied and not independently verified. Do not present it as a live TikTok ranking; no scraping, fabricated popularity, or cross-source growth comparisons. Retains at most 500 observations, query last 1–90 days. Discovery provider, dashboard visualization, scoring and content brief are subsequent work.
## Next stages (not shipped)
1. Immutable draft and human approval with edit/preview/account/explicit privacy & disclosure, short-lived one-use approval bound to payload; separate approval credential/identity from agent.
2. Shared publication service, durable state machine, idempotency, status and audit; first support inbox upload with user completing publication in TikTok. Direct Post only after verifying intended use, audit and TikTok UX requirements. No autonomous or bypassed public posting.
3. MCP tools and OpenAPI; n8n Telegram/WhatsApp workflow with allowlisted chat identity and explicit approval, media from verified URL (or separately designed transfer). Agents never receive OAuth credentials.
4. Trend dashboard and daily research orchestration, provenance and recency. Google Trends is contextual evidence, not TikTok trend measurement. 
## References
https://developers.tiktok.com/docs/en/content-sharing-guidelines
https://developers.tiktok.com/docs/en/oauth-user-access-token-management
https://ads.tiktok.com/resources/help/article/marketing-api?lang=id
https://ads.tiktok.com/resources/help/article/how-to-use-trends

## V3.1 Inbox publication
Agent creates immutable draft with UUID requestId, accountId, HTTPS media URL, suggested caption and mode inbox. Operator reviews exact payload, approves with independent operator credential (15 minutes), then agent executes once. Atomic compare-and-set claims prevent duplicate init across instances. Ambiguous response remains uncertain/sending, never automatically retried. Caption is a suggestion only; Inbox API does not apply it, human finishes in TikTok. Queue currently bounded to 100 records; no deletion/reset or direct posting endpoint. No durable scheduler yet; external workflow must poll status explicitly. Approval credential must be isolated from LLM/agent; trusted human-only UI or authenticated chat callback handles approval. No arbitrary URL fetch from gateway; TikTok verifies media ownership.

## V3.2 MCP
Stateless Streamable HTTP endpoint /api/mcp, bearer credential, compatibility versions 2025-03-26, 2025-06-18, 2025-11-25. JSON responses only; GET/SSE and sessions are unsupported. Use the AGENT key; never expose the operator key to the model. Tools: list_accounts, get_analytics, list_videos, get_capabilities, list_trends, record_trend, prepare_post, list_posts, get_post, execute_approved_post, get_publish_status. Approval is deliberately absent. Client interoperability beyond JSON-RPC integration tests is not yet verified. MCP 2026-07-28 discovery is not yet supported.

## V3.5 update (supersedes inbox-only descriptions above)
Both inbox and profile modes supported. Profile duration required; operator approval supplies approvedCaption and direct settings. Agent cannot approve or alter the approved payload. Creator capability checks are repeated before execution. Unaudited client remains SELF_ONLY on private accounts; existing TikTok Developer settings are unchanged. Terminal records can be archived (100 active records; encrypted archive retained). See OpenAPI and local-first architecture.
