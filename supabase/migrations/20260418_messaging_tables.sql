-- Messaging tables for secure in-app conversations
-- Apply with Supabase SQL editor or migration runner.
create extension if not exists pgcrypto;
create table if not exists public.message_conversations (
  id text primary key,
  item_id uuid null references public.items(id) on delete
  set null,
    title text not null,
    context text null,
    masked_identity text null,
    created_by uuid null references public.profiles(id) on delete
  set null,
    blocked boolean not null default false,
    reported boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.message_participants (
  conversation_id text not null references public.message_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unread_count integer not null default 0,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.message_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.message_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_message_participants_user on public.message_participants(user_id);
create index if not exists idx_message_messages_conversation_created on public.message_messages(conversation_id, created_at);
alter table public.message_conversations enable row level security;
alter table public.message_participants enable row level security;
alter table public.message_messages enable row level security;
drop policy if exists "participants_select_own_conversations" on public.message_participants;
create policy "participants_select_own_conversations" on public.message_participants for
select using (auth.uid() = user_id);
drop policy if exists "participants_insert_own_record" on public.message_participants;
create policy "participants_insert_own_record" on public.message_participants for
insert with check (auth.uid() = user_id);
drop policy if exists "participants_update_own_record" on public.message_participants;
create policy "participants_update_own_record" on public.message_participants for
update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "conversations_select_for_participants" on public.message_conversations;
create policy "conversations_select_for_participants" on public.message_conversations for
select using (
    exists (
      select 1
      from public.message_participants mp
      where mp.conversation_id = message_conversations.id
        and mp.user_id = auth.uid()
    )
  );
drop policy if exists "conversations_insert_authenticated" on public.message_conversations;
create policy "conversations_insert_authenticated" on public.message_conversations for
insert with check (auth.uid() is not null);
drop policy if exists "conversations_update_for_participants" on public.message_conversations;
create policy "conversations_update_for_participants" on public.message_conversations for
update using (
    exists (
      select 1
      from public.message_participants mp
      where mp.conversation_id = message_conversations.id
        and mp.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.message_participants mp
      where mp.conversation_id = message_conversations.id
        and mp.user_id = auth.uid()
    )
  );
drop policy if exists "messages_select_for_participants" on public.message_messages;
create policy "messages_select_for_participants" on public.message_messages for
select using (
    exists (
      select 1
      from public.message_participants mp
      where mp.conversation_id = message_messages.conversation_id
        and mp.user_id = auth.uid()
    )
  );
drop policy if exists "messages_insert_for_participants" on public.message_messages;
create policy "messages_insert_for_participants" on public.message_messages for
insert with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.message_participants mp
      where mp.conversation_id = message_messages.conversation_id
        and mp.user_id = auth.uid()
    )
  );