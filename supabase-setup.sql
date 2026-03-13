-- Run this in Supabase Dashboard -> SQL Editor when provisioning the preview signup stack.
-- This secures newsletter signup behind an Edge Function and rate limiting.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_signup_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS app_private_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_signup_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private_config ENABLE ROW LEVEL SECURITY;

WITH ranked_emails AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(email))
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM newsletter_subscribers
)
DELETE FROM newsletter_subscribers subscribers
USING ranked_emails ranked
WHERE subscribers.id = ranked.id
  AND ranked.duplicate_rank > 1;

UPDATE newsletter_subscribers
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

DROP POLICY IF EXISTS "Allow anonymous insert for newsletter" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Allow anonymous insert for newsletter" ON newsletter_signup_attempts;

ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email_normalized
  ON newsletter_subscribers ((lower(email)));
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at
  ON newsletter_subscribers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_signup_attempts_email_hash_created_at
  ON newsletter_signup_attempts (email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_signup_attempts_ip_hash_created_at
  ON newsletter_signup_attempts (ip_hash, created_at DESC);

REVOKE ALL ON TABLE newsletter_subscribers FROM anon, authenticated;
REVOKE ALL ON TABLE newsletter_signup_attempts FROM anon, authenticated;
REVOKE ALL ON TABLE app_private_config FROM anon, authenticated;