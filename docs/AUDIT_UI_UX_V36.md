# Audit UI/UX V3.6 — 25 November 2026

Scope: source review of production commit 7f27516; browser regression tests use mock TikTok and gateway fixtures. Actual authenticated production account not accessible to reviewer. No TikTok configuration, Local Bridge setup or publishing changes.

| Priority | Finding | Remediation in UX branch |
| --- | --- | --- |
| High | AI operations hidden below overview and unavailable if profile fails | Dedicated AI Agent navigation on desktop/mobile, overview shortcut, usable without loaded profile |
| High | Two operator password inputs for enrollment and operations | Single transient operator session, explicit lock, enrollment and operations share in-memory key |
| High | Health fetch error hides entire integration | Visible checking/not configured/configured/error states, retry; configuration is not proof of connectivity |
| High | Setup prompt hidden in collapsed textarea, links point at old branch | Primary copy CTA, expandable text, clear prerequisites, main links |
| Medium | Repeated create CTA and repeated view metric | One overview create CTA and navigation; no duplicate views tile |
| Medium | Dashboard header repeats public navigation, inconsistent mixed labels | Reduced public links in dashboard, Indonesian agent headings and publication status labels |
| Medium | Account dropdown does not close on outside click, unclear browser vs agent scope | Outside click/Escape, focus restoration, disabled during publish, clarify independent enrollment |
| Medium | Agent data fetch failure may leave stale records without visible freshness | Explicit error/empty states, hide stale operational records on failed refresh |
| Medium | Mobile additions untested | Regression at 320/390/768/1440 widths, setup/error/configured screens and screenshots |

Remaining: visual review of authenticated live dashboard and real agent approval states, actual mobile browser/Safari, full accessibility/contrast testing, larger queue/trend data, more ergonomic status history, publication review and long-form workflow. Test screenshots are generated in CI; passing overflow checks alone does not guarantee visual quality. Do not release automatically merely because this audit exists.

## Follow-up: user screenshot
The desktop sidebar showed each inactive tab as a raised white card due to unconditional shadow-sm in the shared tab primitive; icon/text lacked align-items:center. Replaced it with a flat compact 13rem sidebar, centered icons, concise active account status, smaller spacing and a single active highlight. Removed redundant account explanation. Added desktop computed-style assertions (no row shadow, centered items, max 46px row height). User screenshot is production V3.6 before this revision.

## Actual Chromium render inspection
Downloaded run 45515455553 artifacts and inspected rendered 1440px overview and 320/390px screens. Sidebar is visually flat and compact. Mobile menu icon was collapsed by large horizontal padding inside a fixed-width button; fixed using icon sizing, zero padding and non-shrinking SVG. Setup steps were too tall on mobile; condensed to numbered rows. Operator flow actually loaded data, but rendered English headings caused the assertion failure; fixed labels. CSS transparent shadow layers are not visible shadows; test checks zero-opacity layers as well as none. Actual production user session is not available, mock fixtures exercise the same app code.

Run 45516191509, commit 80fe660: 7 SQLite + 4 onboarding + 15 dashboard + 6 gateway tests passed; production npm audit found zero vulnerabilities. Playwright gateway run erased the first run screenshots because both used the default output directory. Separate output directory and upload before gateway tests added; landing, content, publishing and activity screenshots now captured as well.

## Review of 19 rendered screenshots (run 45516509986)
CI passed all 32 tests; downloaded and opened actual screenshots from Chromium. Mobile menu icon visible again, sidebar compact, onboarding clear. Found a stale active highlight during tab color transition, redundant target card (including broken empty-avatar placeholder) and important notes preceding editor on mobile, cramped 320px video grid, and sticky header captured mid-page because screenshots were taken while scrolled. Removed navigation transitions and explicitly set inactive background, made editor first on mobile, removed redundant target card (account remains in header and editor/review), use one grid column below 400px, and reset scroll before screenshots. Added navigation state and mobile ordering test. No real account/session used.

## Mobile-first revision
User reported oversized toolbar, verbose labels and typography. Reviewed actual 390px Chromium screenshot: top navigation consumed ~310px before the account banner, repeated title/account description, redundant CTA and large KPI cards. Mobile-only fixed bottom tabs, compact one-row toolbar with shortened section titles and icon refresh, shorter copy, smaller KPI and welcome block, card padding, one consistent active nav state, safe-area bottom space, 16px form input text for mobile keyboards. Desktop layout and publication consent/validation preserved. Added viewport screenshot tests at 320/390/430px, toolbar height, visible bottom navigation and input sizes. No TikTok/bridge changes.

Run 45518250006 passed all checks. Inspected all nine viewport screenshots at 320/390/430px; at 320px a large KPI wrapped and source buttons stacked. Follow-up keeps metrics on one line, compact notation for exceptionally long values on mobile (exact value available in title), source selector side by side, and no persistent hover highlight on mobile. Added computed overflow and alignment checks.
