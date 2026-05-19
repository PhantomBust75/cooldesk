-- Phase 03: Assignment & Scheduling Conflicts
-- job_assignments, revisit_assignments, scheduling_conflicts

-- JOB ASSIGNMENTS
CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    technician_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT fk_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_technician FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_assignments_active
    ON job_assignments (job_id) WHERE is_active = TRUE;

-- REVISIT ASSIGNMENTS
CREATE TABLE IF NOT EXISTS revisit_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revisit_id UUID NOT NULL,
    technician_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT fk_revisit FOREIGN KEY (revisit_id) REFERENCES revisits(id) ON DELETE RESTRICT,
    CONSTRAINT fk_technician FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_revisit_assignments_active
    ON revisit_assignments (revisit_id) WHERE is_active = TRUE;

-- SCHEDULING CONFLICTS
CREATE TABLE IF NOT EXISTS scheduling_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    conflicting_job_id UUID NOT NULL,
    technician_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by UUID,
    CONSTRAINT fk_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_conflicting_job FOREIGN KEY (conflicting_job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_technician FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT chk_not_self_conflict CHECK (job_id <> conflicting_job_id),
    CONSTRAINT chk_canonical_order CHECK (job_id < conflicting_job_id),
    UNIQUE (job_id, conflicting_job_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_conflicting ON scheduling_conflicts (conflicting_job_id);
