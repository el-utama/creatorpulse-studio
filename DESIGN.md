# CreatorPulse Studio — Operate visual direction

Status: redesign candidate, not approved or deployed to canonical Sandbox. Supersedes the stale original design specification on this branch only.

## Direction: editorial operations desk
A quiet, daylight work surface that lets the operator scan decisions first. Distinctiveness comes from order and measured density, not decoration. One familiar sans-serif family (system stack for reliable cross-platform rendering), tabular numerals, no display fonts. White working canvas, soft cool-gray navigation, deep blue-ink text, restrained indigo action, semantic amber/red/green reserved for real statuses.

## Tokens
| Token | Value / intent |
|---|---|
| Canvas | #f7f8fa |
| Surface | #ffffff |
| Navigation | #f4f5f8 |
| Ink | #17243a |
| Secondary | #526176 |
| Border | #e0e4eb |
| Action | #4338b7 |
| Selected | #ecebfa |
| Type | 28/24/22 page title by screen, 16 section, 14 body, 13 controls, 12 metadata |
| Space | 4, 8, 12, 16, 20, 24, 32px |
| Radius | 8 controls, 10 grouped surfaces |
| Hit areas | 40 desktop, 44 mobile where practical |

## Composition
Desktop: stable left navigation, shallow workspace header, compact page action. Sidebar account rows indicate selection with a check, not a navigation arrow. Scope remains independent of route and publishing target. No status dot implying live connectivity.

Overview: a compact action center first, then one grouped metric strip (four metrics separated by rules, not nested identical cards), then full-width account performance and secondary content/activity. Action order matches DOM and visual order. Mobile uses the same order with a two-by-two metric group. Account rows retain source and loaded-view provenance. Existing Content, Publishing, Compose, Accounts and Agent behavior is retained in phase one; coherent page-specific redesign follows after comparing actual renders.

## Acceptance
Inspect actual 1440, 1280, 900, 390, 320 renders, including locked, long, empty and failed states; compare before/after. No misleading source, counts, targets or status. Preserve accessibility, existing tests and review boundaries. Do not claim quality from overflow or screenshots alone. See docs/UX_REDESIGN.md. Light-only candidate; no partial dark mode.

## Phase 2: access management and publication workspace
Accounts uses a single responsive directory row per browser identity, with distinct permission labels, three metrics and reachable actions. Do not duplicate table and card representations for management tasks. Full names remain readable. Publishing uses the same grouped summary strip as Accounts, with simple tabs instead of repeated counters. The lock action is labeled Lock session; behavior and consent are unchanged. Content and queue names may wrap rather than lose identity. Native browser acceptance still separate.
