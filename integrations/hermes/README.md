# Hermes without n8n
Hermes handles conversation, messaging, native cron, research and tool orchestration. CreatorPulse handles the TikTok token vault, account monitoring, draft state, approvals and inbox publishing. n8n is optional.

## Prerequisites
Deploy V3; run the [SQLite Local Bridge](../../local-bridge/README.md) on the Hermes host and configure its HTTPS URL plus separate bridge/vault/operator/agent secrets; enroll up to three accounts in the dashboard. No cloud Redis or n8n is required. The gateway is disabled until configured. Real TikTok authorization remains required. No TikTok settings need to be changed by this integration. Hermes must have its own configured model and authorized research tools, and its gateway process must be running on an always-on host for scheduled tasks.

## Connect
1. Merge config.example.yaml into the active Hermes profile config.yaml, keeping existing entries. Store only CREATORPULSE_AGENT_KEY in that profile's .env or secret scope. Never give Hermes the operator key.
2. Copy skills/creatorpulse into the active profile's skills folder (default ~/.hermes/skills/). Start a new session.
3. Configure messaging using hermes gateway setup; permit only your own Telegram/WhatsApp identity. Start the gateway with the normal Hermes setup. Avoid sharing a Telegram bot webhook with n8n.
4. Ask Hermes to list CreatorPulse accounts, then inspect analytics. If tools cannot connect, check the gateway health endpoint and MCP client protocol compatibility. The server uses stateless Streamable HTTP JSON; its compatibility is tested by JSON-RPC tests, not by a live Hermes instance.

## Human approval (no n8n)
Hermes prepares immutable drafts and sends the exact account, video, caption suggestion and draft ID to chat. Open the dashboard and approve in Agent Operations using the operator key. Return to chat and ask Hermes to execute the approved draft. It will send to TikTok inbox, not post publicly; complete publishing in TikTok. Dashboard approval is intentionally outside the model. In-chat approval without this human web step requires a separate trusted callback that verifies the sender and keeps operator credentials inaccessible to Hermes; not implemented here.

## Automation
Ask Hermes to schedule a daily research brief at 06:30 Asia/Jakarta, deliver to your private chat, and use the creatorpulse skill. Use the daily research prompt in SKILL.md. This is an example schedule, not a pre-created cron job. Verify host timezone and cron status. Never schedule unattended posting.
Official docs:
- https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference
- https://hermes-agent.nousresearch.com/docs/user-guide/messaging
- https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
