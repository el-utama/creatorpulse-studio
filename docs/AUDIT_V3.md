# Repository audit — V3.5 (2026-11-25)

> **Arsip historis — audit V3; follow-up V3.6 mengoreksi temuan session binding.** Untuk desain, fitur dan status terkini, baca [Workspace V4](WORKSPACE_V4.md) dan [Local-first architecture](ARCHITECTURE_LOCAL_FIRST.md). Bagian lama di bawah dipertahankan sebagai rekam keputusan, bukan instruksi aktif.
Scope: code review on feat/agent-gateway-v3, previously successful CI 45436178048, official TikTok developer documentation; no live TikTok or Hermes accounts used. At the time of this audit production remained V2. For current production status see Workspace V4.
## Findings and remediation
| Severity | Finding | Status |
| --- | --- | --- |
| High | Agent only supported inbox, contrary to manual dashboard | Fixed: dual mode, duration, human-selected final settings, capability revalidation, exact approved payload. |
| High | Direct settings may be invalid/missing or become stale | Fixed: strict required booleans, creator capabilities validation, reject unsupported privacy, commercial conflicts and expired approval. |
| High | Agent could not free a permanently capped 100-record queue | Fixed: operator-only terminal archival, encrypted records and UUID retained. Archive readable by ID; no resubmission. |
| High | Disconnect could race a publication initialization | Mitigated: account lock around claim/init and verify current token under lock. Already accepted TikTok operations cannot be revoked locally. |
| Medium | Polling repeated unchanged status erased older audit entries | Fixed: no change/no audit event for unchanged status. Still bounded to last 30 events per record. |
| Medium | Stale inbox-only OpenAPI, Hermes skill and privacy descriptions | Updated. Optional n8n template remains inbox-only. |
| Medium | Browser manual publish lacked explicit cross-site check | Added same-origin check. |
| Medium | Refresh/creator capability requests lacked explicit timeout | Added timeouts. |
| Medium | No UI for persistent account disconnect | Added operator account list/disconnect action. |
## Remaining release blockers
- Infrastructure and real-account acceptance: stable authenticated HTTPS route to Local Bridge, server-only secrets, live account enrollment and actual Hermes/Nemotron/WhatsApp/Telegram tool calls. None verified. Vercel health configured flag is not reachability; local bootstrap does actual accounts read.
- Chat-only approval: independent human authentication/approval callback not implemented. Dashboard remains approval authority. Do not provide operator key to model. Direct Post requires review, actual privacy choice, disclosures and consent.
- TikTok policy: internal/team-only tool not an acceptable audited Direct Post intended use. Unaudited clients can test private SELF_ONLY with private accounts, subject to scopes and caps. Do not set audited flag without genuine audit. PULL_FROM_URL requires TikTok-verified domain/prefix and original authorized media. No test of real acceptance. Browser preview verifies duration locally, but remote media URL can change after review: use immutable, versioned media URLs; no content hash verification for remote media at this stage.
- Session ownership: single trusted workspace, two shared bearer roles, no multi-tenant support. Browser binding is slot-based; after disconnect/re-enrollment a previously retained valid binding may regain access. Logout/remove only clears browser, not vault. Operator can disconnect; true revocation of TikTok OAuth must occur in TikTok. Rotate vault key only with explicit re-encryption/re-enrollment plan.
- Resource limits: explicit API calls only, no AI/cron/media-hosting/messaging workload in Vercel; account and queue list batched. Local archive grows over time, monitor disk/backups. Trend data limited to last 500 entries, agent sourced not independent live trend API. No historical analytics time series or automatic trend scoring; Hermes research must be configured.
- Security/operations: no production rate-limiting/load test, no third-party security or dependency vulnerability audit, no real support email verified. Trusted bridge behind TLS + bearer; restrict OS account, firewall and proxy rate limit. Vercel retains token encryption key and API execution, not fully local execution. Hobby plan suitability/usage not measured.
- Installer: Python/PyYAML and actual Hermes profile required; YAML formatting may change; existing messaging and provider values preserved in fixtures. Actual Hermes MCP transport/model behavior unverified.
## Release gate
CI latest must pass. Do not mark production-ready until real setup and read-only acceptance, then explicit owner-reviewed test upload in each requested mode. Do not alter current TikTok Developer configuration or publish content as part of audit. No paid service provisioned.
## Sources
https://developers.tiktok.com/docs/en/content-sharing-guidelines
https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
https://developers.tiktok.com/docs/en/content-posting-api-reference-query-creator-info

## V3.6 follow-up
- Browser binding now includes a random enrollment epoch signed with the vault key; persisted epoch checked before token access, including refresh and reconnect. Disconnect and reenroll invalidates prior browser bindings and approved agent drafts. Existing pre-V3.6 development sessions must reconnect; production V2 cookie sessions are unaffected. Tests cover reenrollment with two separate browser contexts.
- Authenticated agent limit: shared persistent 60 gateway calls per fixed minute across Vercel instances; operator bypasses it. Adds one SQLite request per authorized agent call. This bounds downstream work, **not** incoming Vercel invocations, public health/MCP discovery, unauthorized traffic or manual UI traffic. Edge/firewall limits and actual usage measurement remain necessary. Local MCP discovery stays offline.
- Both approval screens remind the owner to use an immutable media URL. This is an operator attestation, not cryptographic verification of remote media. No server-side remote video download is added. Verified media hosting/immutable URLs still required. TikTok fetches the URL after approval, so TOCTOU risk remains for mutable hosting.
