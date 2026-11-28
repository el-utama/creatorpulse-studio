# CreatorPulse Studio — PROJECT MEMORY

Last recorded: 2026-11-28 (Asia/Jakarta). This is durable repository memory, not a live status API. Read with AGENTS.md before choosing work. Latest owner instructions take precedence; security/release boundaries remain in force. Recheck live state before acting. Do not rely on a prior chat or require the owner to reconstruct a handover.

## 1. Product and owner decisions
- CreatorPulse Studio is a Next.js/React workspace for managing multiple TikTok accounts, evidence-backed research, human-reviewed publishing and truthful publication status. Hermes uses the dedicated Local Bridge/SQLite Sandbox. The MVP uses owner-provided media; actual content generation, autonomous publishing and recurring scheduling are deferred.
- The approved workflow is research -> actual draft/media -> review of exact target, media and caption -> explicit human approval -> execute once -> verify provider outcome. Never invent data, agent connectivity or publication success.
- The owner uses a Mac to communicate with AI; Hermes runs on a separate Windows PC09. Do not make the owner copy long commands or transfer terminal output for work available via connectors. Prefer checked-in scripts/runbooks and a short existing command when owner action is unavoidable. Pull/fetch the exact intended branch first; never reset dirty work.
- Work until usable: audit implementation, actual rendered behavior and every acceptance criterion, fix concrete defects, retest, record evidence and remaining limitations. Ask the owner only for a decision or action genuinely requiring them. Do not claim success from a build alone, repeat accepted tests without reason, or imply work continues after a session ends.
- Owner rejected the original UI, Operate and Studio Desk; accepted Production Workspace on 2026-11-27 conditional on reliability. Freeze this visual direction; do not redesign speculatively. Existing CSS is not sacred, but behavior, data provenance and security are. Use PRODUCT.md, DESIGN.md and the redesign branch's docs/UX_REDESIGN.md and .agents/skills/creatorpulse-ux/SKILL.md. Keep controls concise; do not force verbose translated labels. Mobile usability is essential.

## 2. Repository, branches and environment
- Repository: https://github.com/el-utama/creatorpulse-studio
- **Canonical user-facing Sandbox:** https://creatorpulse-studio-git-sandbox-total-management1.vercel.app
- Redesign branch: feat/ux-operate-redesign; [PR #11](https://github.com/el-utama/creatorpulse-studio/pull/11) targets sandbox, never main. Individual Vercel preview URLs are technical evidence only; do not ask the owner to use them instead of the canonical Sandbox. Verify alias and commit SHA, not just READY.
- Vercel team slug total-management1, project creatorpulse-studio, project ID prj_roRSTwy46Gaw3XpGRlsyGjbXN57u. Production promotion is NOT authorized.
- Local host recovery: AGENTS.md and integrations/hermes/SANDBOX_RUNBOOK.md, using python integrations/hermes/windows_resume.py under existing Hermes Python after clean fast-forward. Controller output is authoritative for host actions. No credentials, operator keys, tokens, private sessions or secret-bearing logs in memory.

## 3. Current milestone — Production Workspace stabilization
Recorded evidence immediately before adding this memory:
| Item | Evidence / state |
|---|---|
| Canonical Sandbox | READY, deployment dpl_CLNw98afrRtUPANACZv96tVVS9GB, baseline 02f5cb08ce26fc1fa254040f5de6f4d5ebcbba71 (older design; app code verified at 007164c, see docs/STATUS.md) |
| Candidate app revision | 9953252d83b09439c0f842a4d914e1b9a493e0fb |
| Candidate preview | READY, dpl_2DzGGSSaQrB2mFjK8rHxvu2vMHQ9, exact candidate SHA |
| Verify | [45938554318](https://github.com/el-utama/creatorpulse-studio/actions/runs/45938554318), rerun job 140308008058 PASS; checkout fee1963175faafc166d864c1a6ef401ba61febb2 (candidate merged into original Sandbox baseline); 29 Chromium + 16 Firefox/WebKit + 14 Gateway + 10 Bridge + 25 Hermes = 94/94 |
| Windows | [45938554367](https://github.com/el-utama/creatorpulse-studio/actions/runs/45938554367), job 140307299109 PASS |
| Current screenshot artifacts | [Verify artifacts](https://github.com/el-utama/creatorpulse-studio/actions/runs/45938554318#artifacts), engine 15171254057 and studio 15171383630 (head 9953252); download and visually inspect the post-fix 320px render before merge |
| PR #11 | Open draft, not merged; prior base 02f5cb0. Documentation commits made to persist this memory change branch tips; exact latest CI and deployment must be checked, not inferred from previous code evidence. |
| Live owner session | Native authenticated Safari/Firefox dashboard and web TikTok playback remain unverified; fixture tests are not proof of these. |

Previous 25594d4 passed 94/94 (Verify 45937708242, Windows 45937708226), fixing inherited two-track mobile search grid (previous width 139px vs >253.4px required). Actual screenshot review then found blank Operator button at 320px: legacy CSS hides svg, new CSS hides label. 9953252 restores svg and adds a visibility/size assertion without weakening old assertions. First CI attempt failed while installing Playwright dependencies due to packages.microsoft.com returning HTTP 403; retry passed all 94 checks, not an application failure. Do not repeat the fix or retry successful CI unnecessarily.

Earlier gateway regression was isolated to test preconditions: fresh vault enrollment, no stale access/refresh cookies, distinct bindings; old binding still requires 401 and old draft execution 409. Never weaken these security assertions.

### Functional acceptance contract
- Overview: action priorities before compact performance metrics; truthful loading/error states.
- Content: gallery default, list optional, provider covers or explicit placeholder, account/date/metrics, search/sort/pagination. Search usable across screen widths.
- Publishing: single responsive job representation, readable caption/target/source/mode/status/update, details retain UUID; Queue/Review/History and approval gate intact.
- Accounts: separate browser OAuth authority and shared/enrolled registry; shared identity alone does not authorize publication.
- Agent: actual status and research evidence, enrollment and integration, no invented online status.
- Compose: explicit target independent of global account scope; dirty draft protected from refresh/navigation; no unauthorized publication.
- Check Chromium/Firefox/WebKit, Gateway, Bridge, Hermes, Windows; responsive widths 320–1600px, no horizontal overflow or blank/covered controls; inspect real screenshot artifacts separately from assertions. Confirm scope, target isolation, review/approval, dirty draft protection.

### Resume from here
1. Fetch current Sandbox and PR #11 heads, CI and Vercel alias. Read the current docs and review exact diff; the latest docs-only commit may supersede recorded SHA without changing runtime code.
2. Inspect post-fix screenshot artifacts of 9953252 (especially mobile 320px Operator and Content toolbar); require equivalent evidence for any later code changes. Fix only concrete regressions, retain assertions, retest.
3. Verify exact PR head/base and successful CI after any branch changes; mark PR ready and merge to sandbox only when visual and functional acceptance pass. Never merge main or promote Production.
4. Verify Sandbox CI and the canonical alias READY at exact integrated SHA. Confirm actual behavior using available safe evidence. Update PROJECT_MEMORY.md and docs/STATUS.md with confirmed checkpoint, code SHA, evidence links, limitations and next action. No further redesign without concrete bug.
5. Do not restart completed upload, installer, read-only host recovery, research or cron acceptance merely because a session changed.

## 4. Completed work and live evidence (do not repeat blindly)
- Owner reported shared enrolled account inventory matches after independent operator unlock in Safari/Firefox; browser-local authorization remains separate. Earlier browser discrepancies and review layout issues are documented in docs/STATUS.md and docs/UI_UX_AUDIT_2026-11-26.md.
- Prior research acceptance: five observations reported, use existing evidence and read-back, do not fabricate new observations or schedule another job. See STATUS and Hermes runbook for exact evidence/host boundaries.
- Prior local Direct Post: draft 7e50b558-7cfe-4cda-8135-5b1dfeb80e33, publish ID v_pub_file~v2-1.7712397286499911700, PUBLISH_COMPLETE / SELF_ONLY reported. Owner confirmed video plays in TikTok mobile. File F:\TOY4U\test_upload.mp4; exact-file reported full FFmpeg decode 459 frames, 13.9755s, H.264 High/yuv420p BT.709, 1280x720, no audio. Web playback root cause remains unknown. Do not re-upload, transcode or retry this accepted draft.
- Rejected draft 15171d24-fca9-4e00-8ab0-e7efacf0c6c0: unaudited_client_can_only_post_to_private_accounts. Do not retry.
- Default Hermes job 8f857395fbd9 completed; leave it untouched. No new cron or recurring jobs authorized. Follow AGENTS.md for any separately authorized dedicated-profile diagnostic.

## 5. Holds, backlog and limitations
- No new live posts, autonomous publishing, recurring schedule, Production promotion, credential changes, reinstall, host service/data changes, or active database mutation for tests. Explicit owner approval required for privileged or new live actions. Do not use this memory as permission to bypass controller/approval.
- Dark mode deferred. Preview feedback toolbar opt-out was requested; disappearance in native browser is unverified. Native Safari/Firefox OAuth and TikTok web playback remain unverified.
- Backend audit backlog remains: provider token concurrency, full-decode attestation, archive/history, leases/timeouts, caption quality, public eligibility and other items in docs/AUDIT_2026-11-26.md. Do not mark resolved solely because UI redesign passes.
- Historical notes can be superseded: use latest verified evidence and owner decisions, retain older audit records. Never expose sensitive information in repo documentation.

## 6. Source map and maintenance
- AGENTS.md: mandatory rules, controller, owner boundaries. PRODUCT.md: scope. DESIGN.md: accepted visual contract on candidate branch; older branch may still show old design. docs/STATUS.md: detailed acceptance history and evidence. docs/AUDIT_2026-11-26.md: broader release-blocking audit. docs/UI_UX_AUDIT_2026-11-26.md: original UX audit. docs/UX_REDESIGN.md (candidate branch): redesign chronology. docs/evidence/: retained owner-reported artifacts. integrations/hermes/SANDBOX_RUNBOOK.md: host procedure.
- Before finishing a work unit (including blocked or partial work), update this file with latest observed facts, exact branch/commit, tests and deployment evidence, decisions, open work and safe next step; link detailed docs instead of copying them. Preserve unresolved items and distinguish owner reports from independently verified evidence. If a docs-only commit changes HEAD, record the tested code SHA separately; don't claim the new SHA was tested until it is.
- Keep AGENTS.md as mandatory entry point, memory concise and current, historical detailed logs in docs. New AI sessions should be able to continue with only repository access and the instruction "Read AGENTS.md and PROJECT_MEMORY.md; resume the recorded milestone." No manual handover required when the repository is current.
