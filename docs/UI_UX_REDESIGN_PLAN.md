# UI/UX V2 release gates

## Scope
Single-account, database-free CreatorPulse MVP. Responsive workspace, content search/sort, guided publishing, independent upload source and destination, creator capability-based privacy and interaction settings, duration/preview checks, commercial and AI disclosure, account-scoped browser history, session recovery and status retry.

## Verified
- CI run 45417827395 (commit 546d1187): npm ci, TypeScript, production build, three Chromium smoke tests passed. Vercel status successful.
- Later commits correct the TikTok source_info.source field, extend disclosures and add upstream contract tests. Later revisions add a request-level idempotency reservation with optional durable Redis. Require green CI on the final commit; earlier results do not certify later changes.

## Official API references
- https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video
- https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide
- https://developers.tiktok.com/docs/en/content-sharing-guidelines

## Release blockers
- Confirm real OAuth scopes, verified media URL ownership and actual TikTok upload/status with an authorized sandbox account; mocked tests do not prove upstream integration. Test private visibility only until TikTok approves public posting.
- Set TIKTOK_DIRECT_POST_AUDITED=true only after TikTok approves public Direct Post; otherwise server exposes SELF_ONLY only. Set a real NEXT_PUBLIC_CONTACT_EMAIL before release. Confirm TikTok app audit status and intended-use eligibility: private/internal team account-management utilities are not an acceptable use case for Direct Post approval.
- Client metadata duration is validated against creator settings, not independently measured on the server; TikTok also validates the media itself.
- Verify keyboard/screen reader accessibility and visual layout on real devices.
- Browser history is limited to 50 entries per account per browser. Same-request retries are protected in a warm process. For cross-instance protection, configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on the server before production (24-hour hashed-key reservation, stores publication ID and outcome; fails closed if configured storage is unavailable). No external database has been provisioned. Multi-account/shared history still needs a storage/session architecture decision. Until then, do not claim production-grade agency functionality.
- Do not merge until the release owner accepts these limits and confirms live checks.

## V2 follow-up
- Video library supports cursor pagination and searches loaded titles/descriptions.
- TikTok errors and terminal failure reasons are shown with safe code labels. Read-only capability/status/analytics requests retry once after token refresh.
- Account identity is checked at publication initialization. Browser pending marker survives reload and cross-tab Web Locks serialize submissions where supported. Clearing an uncertain request requires explicit user acknowledgement. Cross-instance server guarantees still require configured shared storage; browser protection is not a replacement.
