# CreatorPulse V4 — workspace specification and release status
Updated 2026-11-25. This is the active source of truth for UX scope and acceptance, not a claim that the target has been implemented.

## Status
- Source baseline: main 6d9e1f2 (PR #7 merged). Tested head 3d9a78b; [CI 45524478755](https://github.com/el-utama/creatorpulse-studio/actions/runs/45524478755) passed TypeScript, build, dependency audit, Chromium, gateway, Bridge and Hermes tests.
- Production last checked 60c9ae1 (V3), READY; V4 production build blocked by Vercel build-rate limit. Preview V4 READY on the tested head. No paid plan or TikTok configuration changes.
- Owner reported the V4 baseline diverges from the proposed design. R1 reference approved as implementation target; visual acceptance of the resulting live application is OPEN. Do not call this a finished redesign.
- Fixture browser testing at 320/390/430/768/1440 px is not a live-account test. No actual Hermes host, HTTPS bridge, enrollment or chat tool calls validated.

## Approved reference R1
See [interactive HTML](design-r1/index.html) and [design specification](design-r1/DESIGN-SPEC.md). This is the approved target, not a production app. Owner delegated per-screen review to the implementer.

## Design target (not baseline)
Single operator, maximum three accounts. A multi-account operations center, not a personal dashboard with a switcher. No enterprise org/role/billing features. Keep intentional workflow constraints, not legacy component shapes.

| Module | Target |
|---|---|
| Overview | Workspace-level operational metrics; clear scope, account performance rows; needs-attention items with actionable counts when authorized data exists; useful recent/top content. No fabricated time-series, historical views or pending-review counts. |
| Accounts | First-class account directory, compact identity/status/metrics/actions; account-specific content and connection health; distinguish browser session, agent enrollment and actual API availability. |
| Content | Cross-account library with explicit account identity, all-account default, search, filters, sort, list/grid and pagination. |
| Publishing | Queue as primary work surface, explicit source (human/agent), target account, state, review and history; New post opens focused editor with explicit target and consent. No claim of a unified durable manual draft queue until implemented. |
| AI Agent | Operational control center with real connection/availability, enrolled accounts, research and status. Setup secondary to daily operations when configured. Operator and agent privileges remain separate. |

Desktop: compact sidebar with Overview/Accounts/Content/Publishing/AI Agent; workspace canvas, aligned columns, dense useful content, restrained type and spacing. Mobile: purpose-built compact header and bottom nav Home/Accounts/Content/Publish/Agent; two-column compact KPIs, account rows, actionable attention. Short labels, no gratuitous translations, no large welcome hero, no redundant actions, avoid nested cards. Inputs at least 16px on narrow screens to avoid iOS focus zoom; tap targets generally 44px. Desktop and mobile can use different layouts. Prefer semantic accessibility and actual data states over decoration.

## Implemented baseline
- `src/app/dashboard/page.tsx`, `WorkspaceData.tsx`, `TargetPicker.tsx`, `VideoUploadForm.tsx`, `GatewayPanel.tsx`, `AgentWorkspace.tsx`, `HermesOnboarding.tsx`, `globals.css`: current workspace shell and modules.
- Overview sums available profile counts and loaded video views; missing or partial data must be distinguished. No actual pending-review KPI before operator unlock; no measured historical growth. Top Content ranks loaded videos only.
- Accounts shows cards for connected browser sessions; add/disconnect browser accounts. Enrollment is separate in AI Agent. A browser disconnect does not revoke TikTok authorization or remove a gateway account. Legacy cookie session may require reconnect before enrollment.
- Content filters loaded videos by account/query, sorts by recent/views/likes, switches list/grid, requests more pages.
- Publishing > Queue and Review expose agent drafts after operator unlock. New post selects the target account first; active cookie changes only when explicitly selecting another target. Manual publishing still requires review/consent, and Direct Post requires actual capabilities and valid duration. History combines browser-local publication IDs for currently readable accounts; not durable or cross-device. Agent state remains stored in Local Bridge.
- AI Agent shows config state, Bridge and onboarding links, operator unlock/enrollment and agent activity. No chat approval callback; agent never self-approves. No independent live Discovery API. Gateway configuration indicator is not a connectivity test.
- Known UX gaps: current card-heavy Accounts, limited operational Overview, separation of manual/agent history and queue, integration-oriented AI Agent, and compose workflow are not yet accepted as the proposed final design. Reassess against reference design, not old UI. Exact additional differences should be documented from actual screenshot review and owner feedback, not guessed as approved.

## Browser API contract (separate from agent REST/MCP)
| Endpoint | Behavior |
|---|---|
| GET /api/auth/accounts | accounts (slot/name), active, legacy, limit; no tokens |
| POST /api/auth/accounts | action switch/remove, authorized slot; same-origin check |
| GET /api/tiktok/analytics?account=SLOT | profile and first 20-video page for authorized browser slot; no slot = active/legacy |
| GET /api/tiktok/analytics?account=SLOT&cursor=N | next video page; cursor nonnegative integer; no active account switch |
| GET /api/tiktok/creator | capabilities for active account |
| POST /api/tiktok/publish | active account, expected account identity, explicit consent, request ID, validated payload; no automatic replay |
| POST /api/tiktok/publish/status | publish_ids (exactly one), optional accountSlot; scoped read; no slot = active/legacy |
| POST /api/auth/logout | clear all browser sessions, not vault or local history |

Slots are 32 lowercase hex characters and must belong to browser session for scoped reads. A syntactically valid unknown analytics slot fails authorization. Gateway IDs are separate; use [agent OpenAPI](../public/agent-openapi.json) and [local-first architecture](ARCHITECTURE_LOCAL_FIRST.md).

## Acceptance gate
1. Approve concrete reference designs/screens per module and breakpoint before building the next visual revision. Treat screenshots as acceptance reference, not merely rough inspiration.
2. Compare actual app Chromium screenshots side by side against reference (320,390,430,768,1440). Test 1/3 accounts, empty/loading/error, long names, partial metrics, account identity and action hierarchy, no overflow, accessibility, contrast, keyboard and touch. Record unresolved visual differences; passing tests alone cannot close this gate.
3. Preserve explicit target/consent, duplicate/uncertain submission protection, private Direct Post restriction until actual TikTok audit, operator approval boundary, credential isolation, existing OAuth redirect and Hermes configuration.
4. Run full CI, inspect actual screenshots of the exact commit, obtain owner acceptance of the visual result, then verify production alias READY with the intended commit. Preview can be protected or not authorized for OAuth; do not change redirect to work around it.
5. Live acceptance after deployment: connect real accounts, read analytics, test Bridge connectivity, enroll, run actual Hermes MCP and existing private chats. Never post during onboarding; any live publication requires separate explicit review and approval.

## Documentation maintenance
Every feature, security or navigation change must update this spec, relevant user/setup/API docs and tests in the same PR. Do not update effective legal dates or declare compliance/audit without evidence. Current privacy/terms describe existing data handling; no new collection or permission from the visual redesign. Public support contact is still unverified. Keep historical V1–V3 plans marked as archives and link to the active spec. The repository state, preview state, production state, visual acceptance and live integration acceptance must be reported separately.
