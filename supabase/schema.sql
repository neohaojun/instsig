create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_kind as enum ('report_sick', 'external_appointment');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_status as enum (
    'draft',
    'pending',
    'needs_changes',
    'approved',
    'submitted',
    'finalized',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_update_kind as enum (
    'doctor_followup'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  firestore_id text unique,
  name text not null unique,
  description text,
  course_start timestamptz,
  common_term_end timestamptz,
  course_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.batches add column if not exists firestore_id text;
alter table public.batches add column if not exists name text;
alter table public.batches add column if not exists description text;
alter table public.batches add column if not exists course_start timestamptz;
alter table public.batches add column if not exists common_term_end timestamptz;
alter table public.batches add column if not exists course_end timestamptz;
alter table public.batches add column if not exists created_at timestamptz not null default now();
alter table public.batches add column if not exists updated_at timestamptz not null default now();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  rank text,
  role public.app_role not null default 'user',
  batch_id uuid references public.batches(id) on delete set null,
  common_term_platoon text,
  sscc_batch text,
  specialisation_phase_platoon text,
  nr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists rank text;
alter table public.profiles add column if not exists role public.app_role not null default 'user';
alter table public.profiles add column if not exists batch_id uuid references public.batches(id) on delete set null;
alter table public.profiles add column if not exists common_term_platoon text;
alter table public.profiles add column if not exists sscc_batch text;
alter table public.profiles add column if not exists specialisation_phase_platoon text;
alter table public.profiles add column if not exists nr text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  kind public.request_kind not null,
  status public.request_status not null default 'pending',
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requester_email text not null,
  payload jsonb not null default '{}'::jsonb,
  review_note text,
  suggested_payload jsonb,
  submitted_at timestamptz,
  followup_submitted_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  finalized_by uuid references public.profiles(id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.requests add column if not exists kind public.request_kind;
alter table public.requests add column if not exists status public.request_status not null default 'pending';
alter table public.requests add column if not exists requester_id uuid references public.profiles(id) on delete cascade;
alter table public.requests add column if not exists requester_email text;
alter table public.requests add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.requests add column if not exists review_note text;
alter table public.requests add column if not exists suggested_payload jsonb;
alter table public.requests add column if not exists submitted_at timestamptz;
alter table public.requests add column if not exists followup_submitted_at timestamptz;
alter table public.requests add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.requests add column if not exists approved_at timestamptz;
alter table public.requests add column if not exists rejected_by uuid references public.profiles(id) on delete set null;
alter table public.requests add column if not exists rejected_at timestamptz;
alter table public.requests add column if not exists finalized_by uuid references public.profiles(id) on delete set null;
alter table public.requests add column if not exists finalized_at timestamptz;
alter table public.requests add column if not exists created_at timestamptz not null default now();
alter table public.requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.request_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  kind public.request_update_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, kind)
);

alter table public.request_updates add column if not exists request_id uuid references public.requests(id) on delete cascade;
alter table public.request_updates add column if not exists kind public.request_update_kind;
alter table public.request_updates add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.request_updates add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.request_updates add column if not exists created_by_email text;
alter table public.request_updates add column if not exists created_at timestamptz not null default now();
alter table public.request_updates add column if not exists updated_at timestamptz not null default now();

create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  note text,
  changes jsonb,
  created_at timestamptz not null default now()
);

alter table public.request_events add column if not exists request_id uuid references public.requests(id) on delete cascade;
alter table public.request_events add column if not exists actor_id uuid references public.profiles(id) on delete set null;
alter table public.request_events add column if not exists actor_email text;
alter table public.request_events add column if not exists action text;
alter table public.request_events add column if not exists note text;
alter table public.request_events add column if not exists changes jsonb;
alter table public.request_events add column if not exists created_at timestamptz not null default now();

create index if not exists requests_requester_email_idx on public.requests (requester_email);
create index if not exists requests_kind_status_idx on public.requests (kind, status);
create index if not exists request_updates_request_id_idx on public.request_updates (request_id, kind);
create unique index if not exists request_updates_request_id_kind_unique_idx on public.request_updates (request_id, kind);
create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.submit_report_sick_followup(
  p_payload jsonb,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.requests%rowtype;
  v_email text;
begin
  select *
  into v_request
  from public.requests
  where id = p_request_id
    and requester_id = auth.uid()
  for update;

  if not found then
    raise exception 'Request not found or not owned by current user';
  end if;

  if v_request.kind <> 'report_sick'::public.request_kind then
    raise exception 'Only report sick requests can receive follow-up';
  end if;

  if v_request.status not in ('approved'::public.request_status, 'submitted'::public.request_status) then
    raise exception 'Follow-up can only be submitted after approval';
  end if;

  select email into v_email
  from public.profiles
  where id = auth.uid();

  insert into public.request_updates (
    request_id,
    kind,
    payload,
    created_by,
    created_by_email
  )
  values (
    p_request_id,
    'doctor_followup'::public.request_update_kind,
    p_payload,
    auth.uid(),
    v_email
  )
  on conflict (request_id, kind)
  do update set
    payload = excluded.payload,
    created_by = excluded.created_by,
    created_by_email = excluded.created_by_email,
    updated_at = now();

  update public.requests
  set
    followup_submitted_at = now(),
    updated_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.submit_report_sick_followup(jsonb, uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin'::public.app_role from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'user'::public.app_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_requests_updated_at on public.requests;
create trigger set_requests_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

drop trigger if exists set_request_updates_updated_at on public.request_updates;
create trigger set_request_updates_updated_at
before update on public.request_updates
for each row execute function public.set_updated_at();

drop trigger if exists set_batches_updated_at on public.batches;
create trigger set_batches_updated_at
before update on public.batches
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.request_updates enable row level security;
alter table public.request_events enable row level security;
alter table public.batches enable row level security;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "requests self read" on public.requests;
drop policy if exists "requests self insert" on public.requests;
drop policy if exists "requests self update" on public.requests;
drop policy if exists "requests report sick followup update" on public.requests;
drop policy if exists "request updates read" on public.request_updates;
drop policy if exists "request updates requester insert" on public.request_updates;
drop policy if exists "request updates requester update" on public.request_updates;
drop policy if exists "request updates admin" on public.request_updates;
drop policy if exists "events read" on public.request_events;
drop policy if exists "events insert admin" on public.request_events;
drop policy if exists "batches read admin" on public.batches;
drop policy if exists "batches write admin" on public.batches;

create policy "profiles self read" on public.profiles
for select using (auth.uid() = id or public.is_admin());

create policy "profiles self update" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "requests self read" on public.requests
for select using (requester_id = auth.uid() or public.is_admin());

create policy "requests self insert" on public.requests
for insert with check (requester_id = auth.uid());

create policy "requests self update" on public.requests
for update using ((requester_id = auth.uid() and status in ('draft', 'pending', 'needs_changes')) or public.is_admin())
with check ((requester_id = auth.uid() and status in ('draft', 'pending', 'needs_changes')) or public.is_admin());

create policy "requests report sick followup update" on public.requests
for update using (
  requester_id = auth.uid()
  and kind = 'report_sick'::public.request_kind
  and status in ('approved'::public.request_status, 'submitted'::public.request_status)
)
with check (
  requester_id = auth.uid()
  and kind = 'report_sick'::public.request_kind
  and status in ('approved'::public.request_status, 'submitted'::public.request_status)
  and followup_submitted_at is not null
);

create policy "request updates read" on public.request_updates
for select using (exists (
  select 1 from public.requests r
  where r.id = request_id and (
    r.requester_id = auth.uid()
    or public.is_admin()
  )
));

create policy "request updates requester insert" on public.request_updates
for insert with check (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.requester_id = auth.uid()
      and r.kind = 'report_sick'::public.request_kind
      and r.status in ('approved', 'submitted', 'needs_changes')
  )
);

create policy "request updates requester update" on public.request_updates
for update using (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.requester_id = auth.uid()
      and r.kind = 'report_sick'::public.request_kind
      and r.status in ('approved', 'submitted', 'needs_changes')
  )
)
with check (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.requester_id = auth.uid()
      and r.kind = 'report_sick'::public.request_kind
      and r.status in ('approved', 'submitted', 'needs_changes')
  )
);

create policy "request updates admin" on public.request_updates
for all using (public.is_admin())
with check (public.is_admin());

create policy "events read" on public.request_events
for select using (exists (
  select 1 from public.requests r
  where r.id = request_id and (
    r.requester_id = auth.uid()
    or public.is_admin()
  )
));

create policy "events insert admin" on public.request_events
for insert with check (public.is_admin());

create policy "batches read admin" on public.batches
for select using (public.is_admin());

create policy "batches write admin" on public.batches
for all using (public.is_admin())
with check (public.is_admin());
