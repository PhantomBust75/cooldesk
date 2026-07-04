# Backend — NestJS API

See root `CLAUDE.md` for project-wide context and behavioral guidelines.

## Commands

```bash
npm run start:dev     # ts-node-dev --respawn --transpile-only (hot reload)
npm run build         # tsc -p tsconfig.json → dist/
npm start             # node dist/main.js
npm run migrate       # run pending SQL migrations
npm test              # jest --runInBand
```

## Module Structure

```
src/
├── main.ts                    # Bootstrap, listen on PORT (default 3001)
├── modules/
│   ├── app.module.ts          # Single flat module — ALL controllers/providers here
│   ├── auth/                  # Login endpoint + password hashing
│   ├── jobs/                  # Core job lifecycle
│   ├── dealers/               # Dealer CRUD + dealer portal routes
│   ├── payments/              # Payment methods + payment records
│   ├── analytics/             # Aggregated analytics + daily job
│   ├── notifications/         # In-app notifications (staff + dealer)
│   ├── dashboard/             # Owner + metrics dashboard endpoints
│   ├── brands/                # Brand management
│   ├── reviews/               # Customer review links + submission
│   ├── platform/              # Platform admin — org provisioning
│   ├── settings/              # Tenant config key/value store
│   ├── service-items/         # Service item catalogue
│   └── security/              # Guards, decorators, request-context types
└── shared/
    ├── database.service.ts    # pg Pool wrapper — query() + withTransaction()
    └── app-config.service.ts  # typed env var accessors (throws if missing)
```

## Adding a New Route

1. Add method to the service (`*.service.ts`)
2. Add controller handler with the correct guards and `@Roles()` decorator
3. Register nothing — `AppModule` already imports the existing controller

**Do not create new NestJS modules.** Everything goes into the existing `AppModule`.

## Security Guards

Apply guards in this order — `TenantGuard` must come before `RolesGuard`:

```ts
// Staff route
@UseGuards(TenantGuard, RolesGuard)
@Roles('owner')

// Dealer portal route
@UseGuards(DealerGuard)

// Platform admin route
@UseGuards(PlatformAdminGuard)
```

`TenantGuard` sets `req.context: RequestContext { organizationId, userId, role }`.
`DealerGuard` sets `req.dealerContext: DealerRequestContext { organizationId, dealerId }`.

## DTO Pattern

```ts
// Every public input must be a validated DTO
export class CreateFooDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}
```

Use `class-validator` decorators. Never trust raw body objects in service methods.

## Database

`DatabaseService` wraps a `pg` Pool:

```ts
// Single query
const result = await this.db.query<{ id: string }>(
  `SELECT id FROM foo WHERE organization_id = $1`,
  [ctx.organizationId],
);

// Transaction
return this.db.withTransaction(async (client) => {
  await client.query(`INSERT INTO foo ...`, [...]);
  await client.query(`INSERT INTO bar ...`, [...]);
});
```

Always scope queries to `organization_id`. Never query cross-tenant.

## Migrations

- Files: `sql/NNN_description.sql` (sequential numbering)
- Register new files in `migrations/index.ts`
- Run: `npm run migrate`
- **Never edit existing migration files.** Add a new one.

## Environment Variables

Loaded via `ConfigModule` — `.env.local` overrides `.env`:

| Var | Required | Description |
|-----|----------|-------------|
| `DATABASE_URL` | Yes | Neon connection string (with `?sslmode=require`) |
| `JWT_USER_SECRET` | Yes | Signs staff user tokens |
| `JWT_DEALER_SECRET` | Yes | Signs dealer tokens |
| `JWT_PLATFORM_SECRET` | Yes | Signs platform admin tokens |
| `PORT` | No | Listen port (default 3001) |

`AppConfigService.require()` throws at startup if any required var is missing.

## Gotchas

- **`jest --runInBand` is non-negotiable.** Tests hit the real DB and must run sequentially.
- **All JWT token lifetimes are 8h.** Don't change this without updating the frontend session.
- **`dealer_credentials` is a separate table** from `dealers`. Creating a dealer without inserting into both leaves them with no way to log in.
- **`is_deleted = FALSE` is a soft-delete flag** present on most tables. Always include it in queries.
- **`withTransaction` uses a client from the pool.** Don't call `this.db.query()` inside a transaction callback — use the `client` parameter.
