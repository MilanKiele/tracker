create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('food', 'plan')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 24000),
  created_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy ai_conversations_owner on public.ai_conversations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_messages_owner on public.ai_messages
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index ai_conversations_user_updated_idx
  on public.ai_conversations(user_id, updated_at desc);
create index ai_messages_conversation_created_idx
  on public.ai_messages(user_id, conversation_id, created_at);

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
