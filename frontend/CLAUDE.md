# Frontend — Next.js App

See root `CLAUDE.md` for project-wide context and behavioral guidelines.

## IMPORTANT: Non-standard Next.js

This version has breaking changes — APIs, conventions, and file structure may differ from training data. **Read `node_modules/next/dist/docs/` before writing any Next.js-specific code.** Heed deprecation notices.

## Commands

```bash
npm run dev           # next dev --webpack  ← always --webpack, never turbopack
npm run build         # next build
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run test:run      # vitest run --coverage
npm test              # vitest (watch mode)
```

## Directory Structure

```
src/
├── app/
│   ├── (protected)/      # Staff dashboard routes (requires auth session)
│   │   ├── layout.tsx    # Auth gate — blocks unauthenticated, dealer, redirects platform_admin
│   │   ├── dashboard/
│   │   ├── jobs/
│   │   ├── technicians/
│   │   ├── dealer-management/
│   │   ├── analytics/
│   │   └── platform-admin/
│   ├── login/            # Login page — single endpoint for all roles
│   └── review/[token]/   # Public customer review submission
├── components/
│   ├── layout/           # AppShell, Sidebar, navigation
│   ├── jobs/             # JobsList, JobDetail
│   ├── dealers/          # DealerDetailPanel
│   ├── technicians/      # TechnicianDetailPanel
│   └── ui/               # Shared primitives (chips, etc.)
├── contexts/
│   └── auth-context.tsx  # Session state — read/write localStorage
├── lib/
│   ├── api/              # One file per domain — typed fetch wrappers
│   │   ├── client.ts     # ApiError class, apiClient with auth injection
│   │   ├── jobs.ts
│   │   ├── office.ts
│   │   ├── dealers.ts (via office.ts)
│   │   └── …
│   └── permissions.ts    # canAccessRole(role, allowedRoles[])
└── types/
    ├── auth.ts           # UserRole, SessionState, LoginRequest/Response
    ├── jobs.ts
    └── …
```

## Auth & Session

```ts
// Read session in a component
const { session, isAuthenticated, hasRole } = useAuth();

// Role check
hasRole(['owner', 'office_staff'])       // returns boolean
canAccessRole(session?.user.role, [...]) // lib/permissions.ts utility

// Session shape
session.user.role        // 'owner' | 'office_staff' | 'technician' | 'dealer' | 'platform_admin'
session.user.organizationId
session.accessToken      // JWT — injected automatically by apiClient
```

Session is stored under key `"cooldesk.session"` in `localStorage`. `AuthProvider` hydrates it on mount.

**Dealer accounts** are blocked at the login step (`auth-context.tsx`) and again in `(protected)/layout.tsx`. They must not reach the staff dashboard.

## API Client Pattern

```ts
import { apiClient } from "@/lib/api/client";

// GET
const data = await apiClient.get<MyType>("/dealers");

// POST
const result = await apiClient.post<{ id: string }>("/dealers", payload);

// The client automatically injects the Bearer token from session
// Throws ApiError on non-2xx responses
```

**Never call `fetch` directly.** Always use `apiClient` or the typed functions in `src/lib/api/`.

All API calls go to `/api/*` which the Next.js rewrite proxies to `http://localhost:3001/*`.

## Route Protection

`(protected)/layout.tsx` handles three redirect cases on mount:

1. Not authenticated → `/login?next=<current-path>`
2. Role is `dealer` → `/login` (blocked from staff dashboard)
3. Role is `platform_admin` and not on `/platform-admin` → `/platform-admin`

Don't add role checks inside individual pages — add them to the layout or use `canAccessRole` in the component.

## Notifications

Use `useSnackbar()` from notistack everywhere:

```ts
const { enqueueSnackbar } = useSnackbar();
enqueueSnackbar("Saved", { variant: "success" });
enqueueSnackbar(error.message, { variant: "error" });
```

Never use `alert()`, `window.confirm()`, or custom modal dialogs for feedback.

## Gotchas

- **`--webpack` flag**: The dev command is `next dev --webpack`. Turbopack is not used.
- **Hydration**: Form components that use `window`/`localStorage` must be guarded with `useSyncExternalStore` or conditional rendering. See login page for the `hasHydrated` pattern.
- **API prefix**: `NEXT_PUBLIC_API_BASE_URL` is `/api` (proxied). Don't hardcode `http://localhost:3001` in any frontend file.
- **`ApiError`**: Always catch as `error instanceof ApiError` to get the typed `.status` and `.message`. The generic `Error` catch is a fallback only.
- **`@tanstack/react-query`**: Used for server data. Keep query keys consistent — prefer string arrays `['jobs', jobId]`.
- **No barrel exports** (`index.ts`): Import directly from the source file.
