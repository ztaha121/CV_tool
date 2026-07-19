-- Run this in Supabase SQL Editor before using Face ID / passkeys.

create table if not exists unlocked_purchases (
  email text primary key,
  purchased_at timestamptz not null default now()
);
alter table unlocked_purchases enable row level security;
-- No policies added — only accessed via service-role key from serverless functions.

create table if not exists webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists webauthn_credentials_email_idx on webauthn_credentials(email);

create table if not exists webauthn_challenges (
  identifier text primary key, -- either a user_id (registration) or email (sign-in)
  challenge text not null,
  created_at timestamptz not null default now()
);

-- These tables are only ever accessed via the service-role key from serverless
-- functions, never directly from the browser, so RLS can stay locked down:
alter table webauthn_credentials enable row level security;
alter table webauthn_challenges enable row level security;
-- (No policies added — service role bypasses RLS entirely, which is what we want.)
