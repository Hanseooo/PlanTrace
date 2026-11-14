-- PlanTrace schema (ARCHITECTURE.md "Data model"). `questions` is deferred with F7.
-- Domain strings match the Literal types in api/app/models.py (CODING_STANDARDS.md section 5).

-- Already installed on Supabase, so IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE lgus (
    psgc_code text PRIMARY KEY,
    name text NOT NULL,
    level text NOT NULL
);

CREATE TABLE plans (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lgu_psgc text NOT NULL REFERENCES lgus (psgc_code),
    type text NOT NULL
        CHECK (type IN ('CLUP', 'CDP', 'LDIP', 'AIP', 'LDRRMP', 'LCCAP', 'Other')),
    title text NOT NULL,
    period_start integer NOT NULL,
    period_end integer NOT NULL,
    status text NOT NULL DEFAULT 'extracting'
        CHECK (status IN ('extracting', 'ready', 'confirmed', 'failed')),
    error text
);

CREATE TABLE pages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id bigint NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    page_no integer NOT NULL,
    text text NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    UNIQUE (plan_id, page_no)
);

CREATE INDEX pages_tsv_idx ON pages USING gin (tsv);

-- D3 sector list (issue #1). Repeated in zones.forbidden_sectors below.
CREATE TABLE ppas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id bigint NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    code text,
    title text,
    description text,
    office text,
    sector text CHECK (sector IN (
        'housing', 'drainage', 'flood_control', 'roads', 'evacuation', 'agriculture',
        'water_supply', 'health', 'education', 'livelihood', 'commercial', 'industrial'
    )),
    barangays text[] NOT NULL DEFAULT '{}',  -- PSGC codes
    cost numeric,  -- pesos
    year_start integer,
    year_end integer,
    page_id bigint REFERENCES pages (id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    -- D5: a reviewed finding is kept on re-run while both PPAs are older than reviewed_at.
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keeps ppas.updated_at honest for D5 without every UPDATE having to remember it.
-- An UPDATE that sets updated_at itself (seed scripts, tests) keeps its value.
CREATE FUNCTION ppas_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER ppas_touch_updated_at
BEFORE UPDATE ON ppas
FOR EACH ROW EXECUTE FUNCTION ppas_touch_updated_at();

CREATE TABLE zones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id bigint NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    barangay text NOT NULL,  -- PSGC code
    zone_type text,
    hazard text,
    forbidden_sectors text[] NOT NULL DEFAULT '{}' CHECK (forbidden_sectors <@ ARRAY[
        'housing', 'drainage', 'flood_control', 'roads', 'evacuation', 'agriculture',
        'water_supply', 'health', 'education', 'livelihood', 'commercial', 'industrial'
    ]::text[]),
    page_id bigint REFERENCES pages (id) ON DELETE SET NULL
);

CREATE TABLE links (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    child_ppa_id bigint NOT NULL REFERENCES ppas (id) ON DELETE CASCADE,
    parent_ppa_id bigint NOT NULL REFERENCES ppas (id) ON DELETE CASCADE,
    source text NOT NULL CHECK (source IN ('ai', 'manual')),
    status text NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    UNIQUE (child_ppa_id, parent_ppa_id)
);

-- "check" is a reserved word: quote it in every query.
CREATE TABLE findings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "check" text NOT NULL CHECK ("check" IN ('duplicate', 'orphan', 'ccc', 'zone')),
    ppa_a bigint NOT NULL REFERENCES ppas (id) ON DELETE CASCADE,
    ppa_b bigint REFERENCES ppas (id) ON DELETE CASCADE,  -- null for a zone finding
    verdict text CHECK (verdict IN ('Conflict', 'Compatible', 'Complementary')),
    reason text NOT NULL,
    page_ids bigint[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    note text,
    created_by text NOT NULL CHECK (created_by IN ('ai', 'rule')),
    reviewed_at timestamptz  -- D5: set when status leaves 'suggested'
);

CREATE TABLE ai_cache (
    key text PRIMARY KEY,  -- hash of model, prompt and input
    response text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
