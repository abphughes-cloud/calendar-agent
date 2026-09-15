-- Calendar Planner: Supabase planning-layer schema.
-- Run this once in the Supabase SQL editor for your project.
--
-- Auth note: this app authenticates via NextAuth/Google, not Supabase
-- Auth, so there is no auth.uid() to scope rows by. For this single-user
-- personal app, RLS is enabled on every table with a permissive policy
-- for the anon/publishable key. Tighten this (e.g. add a user id column
-- and scope policies by it) before this app is ever used by more than
-- one person.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- user_preferences: single-user triathlon planning preferences.
-- ---------------------------------------------------------------------
create table if not exists user_preferences (
  id uuid primary key default gen_random_uuid(),
  race_goal text,
  race_date date,
  weekly_training_hours numeric,
  preferred_training_times text,
  avoid_times text,
  location_notes text,
  recovery_notes text,
  free_text_memory text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- plan_events: manually created planning entries, overlaid on the
-- read-only Google Calendar view. Never written back to Google.
-- ---------------------------------------------------------------------
create table if not exists plan_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  intensity text,
  status text not null default 'planned',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- agent_suggestions: reserved for a future LLM-driven suggestion
-- feature. No app code reads/writes this table yet.
-- ---------------------------------------------------------------------
create table if not exists agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  intensity text,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- feedback: reserved for feedback on future agent suggestions. No app
-- code reads/writes this table yet.
-- ---------------------------------------------------------------------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references agent_suggestions(id) on delete cascade,
  action text,
  feedback_text text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at auto-touch trigger
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_preferences_set_updated_at on user_preferences;
create trigger user_preferences_set_updated_at
  before update on user_preferences
  for each row execute function set_updated_at();

drop trigger if exists plan_events_set_updated_at on plan_events;
create trigger plan_events_set_updated_at
  before update on plan_events
  for each row execute function set_updated_at();

drop trigger if exists agent_suggestions_set_updated_at on agent_suggestions;
create trigger agent_suggestions_set_updated_at
  before update on agent_suggestions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security (see note at top of file)
-- ---------------------------------------------------------------------
alter table user_preferences enable row level security;
alter table plan_events enable row level security;
alter table agent_suggestions enable row level security;
alter table feedback enable row level security;

drop policy if exists "Allow all access (single-user app)" on user_preferences;
create policy "Allow all access (single-user app)" on user_preferences
  for all using (true) with check (true);

drop policy if exists "Allow all access (single-user app)" on plan_events;
create policy "Allow all access (single-user app)" on plan_events
  for all using (true) with check (true);

drop policy if exists "Allow all access (single-user app)" on agent_suggestions;
create policy "Allow all access (single-user app)" on agent_suggestions
  for all using (true) with check (true);

drop policy if exists "Allow all access (single-user app)" on feedback;
create policy "Allow all access (single-user app)" on feedback
  for all using (true) with check (true);
