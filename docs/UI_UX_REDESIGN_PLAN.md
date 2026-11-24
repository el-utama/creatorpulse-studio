# UI/UX V2 rollout

This branch stabilizes the existing single-account MVP. Do not merge until verification passes.

## Implemented
- Controlled tabs, client-side publish lock, inline errors, explicit direct-post privacy, mobile labels, account-scoped local history, bounded polling, honest landing copy, wider workspace and portrait content.
- Separate TikTok inbox/direct endpoints, normalized response data, single-file PUT transfer and server validation.

## Release gates (not yet verified)
- npm ci; npx tsc --noEmit; npm run build.
- Test login cancellation, expired session, analytics failure, 320/390/768/1440px layouts, keyboard and screen reader access.
- Test inbox and direct post against authorized TikTok sandbox accounts, verified URL ownership, privacy capabilities, upload failure, duplicate clicks, status polling and page reload. Never test public posting without explicit consent.
- Confirm API schemas against official TikTok documentation; implement creator-info capability query and server-side idempotency before production.

## Remaining scope
- Dedicated workspace shell and guided review screen, sortable and paginated library, multi-account architecture, durable shared history, session refresh persistence, partial analytics recovery, automated browser tests. Local history contains up to 50 IDs per account per browser and is not cross-device storage.
