# CreatorPulse redesign — acceptance candidate

Base 02f5cb0 (82 automated checks passed, exact canonical Sandbox READY). Owner reports appearance still weird. Prior 007164c Chromium fixture renders at 1440 and 390 inspected: duplicate scope and browser/shared explanations compete with data, repeated identical metric tiles and decorative icon blocks fragment the surface, action center is below the fold on phone, sidebar chevrons imply navigation even when selecting scope, uppercase shared label wraps, ambiguous workspace dot. Existing PRODUCT.md/DESIGN.md were stale and already Impeccable-shaped; installing a second copy alone would not solve this.

## Approach
Lead with Impeccable Operate / critique and design direction; use Pro Max for system/interaction constraints, Frontend Design for visual composition/copy, Web Interface Guidelines for QA. See project skill for exact upstream SHAs. Their text was reviewed; external runtimes are not installed/executed. Existing code and verified Sandbox remain intact on separate branch.

## Phase 1 — shell and Overview
One action center before data; grouped metrics; full-width performance table; secondary activity; selection check instead of chevron; concise scope and heading copy; restrained neutral surfaces; no false online indicator. Preserve all data, state, scope, consent and existing routes. New stylesheet scoped to cp-operate; old geometry intentionally retained during migration, not yet consolidated. Automated visual/functional test added for hierarchy and group representation; CI and before/after render acceptance pending. No backend or publication changes.

## Remaining
Audit the new actual screenshots against design criteria, correct any regressions, then migrate Content, Accounts, Publishing/review and Agent/Compose surfaces coherently. Verify exact preview, no user-authenticated browser claim, preserve existing release hold. Do not merge canonical Sandbox before candidate visual acceptance. Dark mode not in this candidate.
