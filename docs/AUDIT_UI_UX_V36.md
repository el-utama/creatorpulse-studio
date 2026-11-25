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
