-- Harden reset-code storage table exposed via PostgREST.
-- This table is only accessed by server-side code and should not be readable/writable from client roles.
alter table if exists public.password_reset_codes enable row level security;
alter table if exists public.password_reset_codes force row level security;
revoke all on table public.password_reset_codes
from anon;
revoke all on table public.password_reset_codes
from authenticated;