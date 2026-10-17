-- Approved additive table only. Also prepared idempotently by accountRevocations.ts.
-- Do not run a schema-wide push or modify existing data to enable withdrawal.
CREATE TABLE IF NOT EXISTS account_revocations (
  subject_hash varchar(64) NOT NULL PRIMARY KEY,
  revoked_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
