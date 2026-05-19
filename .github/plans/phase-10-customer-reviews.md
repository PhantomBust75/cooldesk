# Phase 10 — Customer Reviews

## Objective

Introduce org-configurable post-completion customer reviews with tokenized access, mode-driven technician flow, and analytics integration.

## Scope

- `customer_reviews` DDL with `organization_id`, generated columns, and `is_low_rated` CASE expression
- `customer_review_mode` config key: `off`, `optional`, `mandatory`
- Secure 48-hour review link lifecycle (WhatsApp / SMS share)
- Token-org-job binding validation before accepting submission
- Owner review dashboard and low-rated flag workflow
- Analytics `avg_star_rating` NULL guard when mode is `off`

## Implementation Backlog

### 1) Schema (Schema v2.2 §B.14)

```sql
CREATE TABLE customer_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  review_token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  star_rating       INT  CHECK (star_rating BETWEEN 1 AND 5),
  comment           TEXT,
  submitted_at      TIMESTAMPTZ,
  link_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ GENERATED ALWAYS AS
                      (link_generated_at + INTERVAL '48 hours') STORED,
  is_low_rated      BOOLEAN GENERATED ALWAYS AS (
                      CASE WHEN star_rating IS NOT NULL
                           THEN star_rating <= 2
                           ELSE NULL
                      END
                    ) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_org ON customer_reviews (organization_id, submitted_at DESC);
CREATE INDEX idx_reviews_low_rated ON customer_reviews (organization_id)
  WHERE is_low_rated = TRUE;
```

**`is_low_rated` NULL propagation (v2.2):** The CASE expression explicitly returns NULL when `star_rating IS NULL` (link generated but not yet submitted). A plain `star_rating <= 2` would also produce NULL, but the explicit CASE makes the intent unambiguous and survives future refactors. `is_low_rated` is `NULL` until submitted, `TRUE` for ratings 1–2, `FALSE` for ratings 3–5.

**`expires_at` is STORED generated:** Computed from `link_generated_at + INTERVAL '48 hours'`. Cannot be set directly. Querying expired tokens: `WHERE expires_at < NOW()`.

**`UNIQUE` on `review_token`:** One token per job. Regenerating a link reuses the same `customer_reviews` row (UPDATE `review_token`, `link_generated_at`), which cascades to a new `expires_at`.

### 2) Mode Control (Flow 12.3)

`customer_review_mode` values: `off` | `optional` | `mandatory`

Read via:
```typescript
const mode = await this.configService.get(orgId, 'customer_review_mode'); // default: 'off'
```

| Mode | Technician behaviour at completion |
|------|------------------------------------|
| `off` | No review UI shown. No `customer_reviews` row created. |
| `optional` | Review link UI shown. Technician may dismiss without generating link. |
| `mandatory` | Review link UI shown. Technician **cannot proceed** to mark job complete without generating link first. |

**Mode change policy:** Applies to new completions only. Jobs already in `completed` / `resolved` / `resolved_on_revisit` states are unaffected. No backfill of `customer_reviews` rows on mode change. This is enforced by reading mode at completion time, not at job creation time.

### 3) Review Link Lifecycle (Flow 12.1 / 12.2)

**Link generation (at job completion):**
1. Read `customer_review_mode` from `ConfigService`.
2. If `mandatory`: block completion until technician taps "Generate Link".
3. If `optional`: show "Generate Link" button; technician may skip.
4. On generate: `INSERT INTO customer_reviews (job_id, organization_id, review_token, link_generated_at)`.
5. Construct review URL with `review_token`. Technician shares via WhatsApp or SMS from PWA.

**Link format:** `https://<app-domain>/review/<review_token>` — token only, no `job_id` or `organization_id` in URL. Server resolves both from the token.

**Expiry:** Token is valid for 48 hours from `link_generated_at`. After expiry, submission endpoint returns HTTP 410 Gone.

**Regeneration:** If technician needs to re-share after expiry (or before submission), generate a new token:
```sql
UPDATE customer_reviews
SET review_token = gen_random_uuid(),
    link_generated_at = NOW(),
    updated_at = NOW()
WHERE job_id = :jobId AND organization_id = :orgId;
```
`expires_at` is recomputed automatically by the generated column.

### 4) Submission Flow (Flow 12.2)

Customer opens link on personal device (no login required).

**Server-side validation before accepting:**
```sql
SELECT cr.id, cr.job_id, cr.organization_id, cr.expires_at, cr.submitted_at
FROM customer_reviews cr
WHERE cr.review_token = :token;
```

Rejection conditions:
- Token not found → HTTP 404
- `expires_at < NOW()` → HTTP 410 Gone
- `submitted_at IS NOT NULL` → HTTP 409 Conflict (already submitted; no re-submission)
- Cross-org impossible: token resolves to exactly one `(job_id, organization_id)` pair

**On valid submission:**
```sql
UPDATE customer_reviews
SET star_rating   = :rating,
    comment       = :comment,
    submitted_at  = NOW(),
    updated_at    = NOW()
WHERE review_token = :token
  AND submitted_at IS NULL
  AND expires_at > NOW();
```

`is_low_rated` is recomputed automatically by the generated column on UPDATE.

Write `review_submitted` timeline event on `job_timeline` (actor = NULL for customer-side action):
```sql
INSERT INTO job_timeline (job_id, event_type, actor_user_id, new_value, organization_id)
VALUES (:jobId, 'review_submitted', NULL,
        json_build_object('star_rating', :rating, 'is_low_rated', :isLowRated)::jsonb,
        :orgId);
```

Dispatch `low_rating_received` notification → owner + office staff, if `is_low_rated = TRUE` (after UPDATE resolves the generated column).

### 5) Owner Review Dashboard (Flow 12.4)

All queries filtered by `organization_id = :orgId`.

- List all submitted reviews: `WHERE submitted_at IS NOT NULL AND organization_id = :orgId ORDER BY submitted_at DESC`
- Low-rated filter: `WHERE is_low_rated = TRUE AND organization_id = :orgId`
- Low-rated job cards surfaced on owner dashboard (same amber-style indicator as revisit alerts)

Owner can navigate from a low-rated review card directly to the job detail.

**Analytics integration:**
- `analytics_business_daily.avg_star_rating` — computed only from submitted reviews within the date window.
- `avg_star_rating` must be `NULL` (not 0) when `customer_review_mode = 'off'` for the org, or when no reviews were submitted in the period. Use `AVG(star_rating)` — SQL AVG already returns NULL on empty set.
- `analytics_brand_daily` and `analytics_technician_daily` may carry per-brand/per-technician avg ratings; org-scoped only.

### 6) Notification Events

| Event | Owner | Office Staff | Technician | Dealer |
|-------|-------|--------------|------------|--------|
| `low_rating_received` | ✓ | ✓ | — | — |

Dispatched inline after submission UPDATE confirms `is_low_rated = TRUE`. Uses standard `ON CONFLICT DO NOTHING` dedup via `idx_notif_dedup_user_job`.

## Required Test Coverage

- Token from org A cannot submit a review for org B's job (token resolves to one org only).
- Expired token (>48h) returns HTTP 410.
- Already-submitted token returns HTTP 409; rating unchanged.
- Mode `mandatory`: completion endpoint rejects if no `customer_reviews` row exists for the job.
- Mode `optional`: completion proceeds without a `customer_reviews` row.
- Mode change in org A does not affect org B's behaviour.
- Mode change applies only to future completions; already-completed jobs unaffected.
- `is_low_rated` is NULL before submission, TRUE for rating ≤ 2, FALSE for rating ≥ 3.
- `avg_star_rating` is NULL in analytics when mode is `off` or no reviews submitted.
- `low_rating_received` notification dispatched only within the affected org.
- Regenerated token updates `expires_at` (generated column recalculates from new `link_generated_at`).

## Exit Criteria

- Review workflow is secure, tenant-isolated, and mode-driven end-to-end.
- Token expiry and single-submission constraints enforced at DB and service layers.
- Owner receives actionable low-rating visibility with navigation to affected jobs.
- Analytics respects mode setting and never aggregates across org boundaries.

## Risks and Mitigations

- **Risk:** `is_low_rated` returns FALSE instead of NULL for unsubmitted reviews, polluting low-rated filter.
  - **Mitigation:** Explicit NULL-propagating CASE expression in generated column; NULL means "not yet rated", FALSE means "rated and not low".
- **Risk:** Customer submits review twice (double-tap or retry).
  - **Mitigation:** `submitted_at IS NOT NULL` guard in UPDATE WHERE clause; concurrent retries both fail after first write; HTTP 409 returned.
- **Risk:** Technician bypasses mandatory mode by calling completion API directly.
  - **Mitigation:** Service layer checks `customer_reviews` row existence for job before accepting completion; no client-side bypass possible.
