-- MANUAL, ADDITIVE MIGRATION ONLY. Requires explicit production approval before deployment.
-- Preserve all existing IDs, password hashes, social links, records and signing keys.
-- Do not run db:push as a substitute. Do not seed from users.email/provider emails.
ALTER TABLE users ADD COLUMN auth_version int NOT NULL DEFAULT 0;
CREATE TABLE account_recovery_emails (
  user_id int NOT NULL PRIMARY KEY,
  email varchar(320) NOT NULL,
  email_key varchar(64) NOT NULL,
  verified_at timestamp NOT NULL,
  UNIQUE KEY account_recovery_email_unique (email_key)
);
CREATE TABLE account_recovery_tokens (
  token_hash varchar(64) NOT NULL PRIMARY KEY,
  user_id int NOT NULL,
  kind enum('verify','password') NOT NULL,
  language enum('ko','en','ja') NOT NULL,
  email varchar(320) NOT NULL,
  auth_version int NOT NULL,
  expires_at timestamp NOT NULL,
  KEY account_recovery_token_owner (user_id),
  KEY account_recovery_token_expiry (expires_at)
);
CREATE TABLE account_recovery_limits (
  limit_key varchar(64) NOT NULL PRIMARY KEY,
  hits int NOT NULL,
  expires_at timestamp NOT NULL,
  KEY account_recovery_limit_expiry (expires_at)
);
