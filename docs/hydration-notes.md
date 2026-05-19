# Hydration Notes (Next.js + React)

## Why this exists

We saw hydration warnings in development caused by browser extensions injecting attributes on `<body>` (for example Grammarly-related attributes) before/during hydration.

This file records official guidance and the project decision for handling it.

## Official documentation

- Next.js hydration error guide:
  - https://nextjs.org/docs/messages/react-hydration-error
- Next.js `Script` component (`beforeInteractive`):
  - https://nextjs.org/docs/app/api-reference/components/script
- React `hydrateRoot` reference and caveats:
  - https://react.dev/reference/react-dom/client/hydrateRoot

## Key takeaways from official docs

1. Hydration expects matching server and client markup.
   - React treats mismatches as bugs.
2. Browser extensions are a documented mismatch cause.
   - Next.js explicitly lists extension-modified HTML as a common cause.
3. `suppressHydrationWarning` is an escape hatch.
   - Intended for unavoidable differences and only one level deep.
   - Should not be the default solution for avoidable mismatches.
4. `beforeInteractive` scripts run before hydration in App Router root layouts.
   - Appropriate for critical pre-hydration DOM normalization.

## Project decision

- We do **not** rely on blanket `suppressHydrationWarning` for root elements.
- We normalize known extension-injected attributes early using `next/script` with `strategy="beforeInteractive"` in `frontend/src/app/layout.tsx`.
- We keep the normalization scoped to known extension attributes to avoid altering app-owned DOM state.

## Current implementation location

- `frontend/src/app/layout.tsx`
  - Inline `beforeInteractive` script removes known extension attributes from `<body>` during the initial hydration window.

## If warnings appear again

1. Confirm which attributes differ using browser console hydration logs.
2. Verify whether they are injected by extensions or third-party scripts.
3. Prefer fixing the source mismatch first.
4. Only use `suppressHydrationWarning` for genuinely unavoidable differences.

## Notes for local verification

- Reproduce with the same browser extensions enabled.
- Hard refresh the app and check for hydration warnings in the console.
- Validate both dev and production builds where feasible.
