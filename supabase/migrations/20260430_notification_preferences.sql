alter table if exists public.profiles
add column if not exists notification_message_alerts boolean not null default true,
  add column if not exists notification_email_updates boolean not null default false;