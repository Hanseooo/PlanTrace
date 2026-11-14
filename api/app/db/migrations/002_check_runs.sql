-- S4-01: the last check run survives a reload and an api restart (AC-30, AC-31),
-- and a finding stores the barangay it is grouped under (AC-26).

CREATE TABLE check_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ran_at timestamptz NOT NULL DEFAULT now(),
    counts jsonb NOT NULL  -- the CheckCount list that POST /checks/run returns
);

-- PSGC code. Null when the finding's PPAs have no barangay.
ALTER TABLE findings ADD COLUMN barangay text;
