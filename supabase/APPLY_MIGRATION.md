# Automatic Supabase Migration

Use VS Code terminal to apply schema changes without SQL Editor.

## Run migrations

1. Ensure .env has database credentials.
2. Run:

```bash
npm run db:migrate
```

The migration runner applies all pending SQL files in supabase/migrations and records each one in public.schema_migrations.

## Verify required tables

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'items',
    'item_images',
    'matches',
    'claims',
    'conversations',
    'messages',
    'notifications',
    'flags',
    'audit_logs',
    'schema_migrations'
  )
order by table_name;
```

## Password storage (hashed)

- Do not create a custom plaintext password table.
- Supabase Auth stores hashed passwords in auth.users.encrypted_password.
- Signup/login/reset in the app now use Supabase Auth, so password transactions are validated through database-backed auth.

## Security warning notes

- function_search_path_mutable: fixed by migration 20260415_000002_auth_rls_hardening.sql.
- public_bucket_allows_listing: fixed by migration 20260415_000002_auth_rls_hardening.sql.
- auth_leaked_password_protection: this is an Auth dashboard setting, not a SQL migration.

## SMTP and reset-code emails

SMTP is configured in Supabase Dashboard:

1. Authentication -> Providers -> Email.
2. Enable custom SMTP and set your sender account credentials.
3. Save and run a reset-password test from the app.

## Disable signup email confirmation

If you want users to log in immediately after signup (no Gmail/email confirmation step):

1. Open Authentication -> Providers -> Email.
2. Disable Confirm email.
3. Save changes.

When Confirm email is disabled, signup returns a session immediately and the app will not require inbox verification.

## If migration fails with password authentication

1. Open Supabase Dashboard -> Project Settings -> Database.
2. Reset or copy the current database password.
3. Update .env values.
4. Re-run npm run db:migrate.
