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

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  parent_unit_id uuid references public.units(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.units add column if not exists code text;
alter table public.units add column if not exists name text;
alter table public.units add column if not exists parent_unit_id uuid references public.units(id) on delete restrict;
alter table public.units add column if not exists active boolean not null default true;
alter table public.units add column if not exists created_at timestamptz not null default now();
alter table public.units add column if not exists updated_at timestamptz not null default now();

create unique index if not exists units_code_unique_idx on public.units (code);
create index if not exists units_parent_unit_id_idx on public.units (parent_unit_id);

insert into public.units (code, name)
values ('SI', 'SI')
on conflict (code) do update set name = excluded.name, active = true;

insert into public.units (code, name, parent_unit_id)
values
  ('SALS', 'SALS', (select id from public.units where code = 'SI')),
  ('SVTS', 'SVTS', (select id from public.units where code = 'SI'))
on conflict (code) do update set
  name = excluded.name,
  parent_unit_id = excluded.parent_unit_id,
  active = true;

insert into public.units (code, name, parent_unit_id)
values
  ('SCTW', 'SCTW', (select id from public.units where code = 'SALS')),
  ('OCTW', 'OCTW', (select id from public.units where code = 'SALS')),
  ('DEMO', 'Demo', (select id from public.units where code = 'SALS')),
  ('WAC', 'SVTS WAC', (select id from public.units where code = 'SVTS')),
  ('TAC', 'SVTS TAC', (select id from public.units where code = 'SVTS'))
on conflict (code) do update set
  name = excluded.name,
  parent_unit_id = excluded.parent_unit_id,
  active = true;

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
alter table public.batches add column if not exists unit_id uuid references public.units(id) on delete restrict;
alter table public.batches add column if not exists name text;
alter table public.batches add column if not exists description text;
alter table public.batches add column if not exists course_start timestamptz;
alter table public.batches add column if not exists common_term_end timestamptz;
alter table public.batches add column if not exists course_end timestamptz;
alter table public.batches add column if not exists created_at timestamptz not null default now();
alter table public.batches add column if not exists updated_at timestamptz not null default now();
alter table public.batches drop constraint if exists batches_name_key;
create unique index if not exists batches_unit_name_unique_idx on public.batches (unit_id, name);

comment on column public.batches.common_term_end is
  'Course phase boundary: the specialisation phase starts on this date.';

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
  ooc_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists rank text;
alter table public.profiles add column if not exists role public.app_role not null default 'user';
alter table public.profiles add column if not exists unit_id uuid references public.units(id) on delete restrict;
alter table public.profiles add column if not exists batch_id uuid references public.batches(id) on delete set null;
alter table public.profiles add column if not exists common_term_platoon text;
alter table public.profiles add column if not exists sscc_batch text;
alter table public.profiles add column if not exists specialisation_phase_platoon text;
alter table public.profiles add column if not exists nr text;
alter table public.profiles add column if not exists ooc_date date;
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
alter table public.requests add column if not exists unit_id uuid references public.units(id) on delete restrict;
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

create table if not exists public.strength_records (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  duty_date date not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strength_records add column if not exists category text;
alter table public.strength_records add column if not exists unit_id uuid references public.units(id) on delete restrict;
alter table public.strength_records add column if not exists profile_id uuid references public.profiles(id) on delete cascade;
alter table public.strength_records add column if not exists duty_date date;
alter table public.strength_records add column if not exists note text;
alter table public.strength_records add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.strength_records add column if not exists created_at timestamptz not null default now();
alter table public.strength_records add column if not exists updated_at timestamptz not null default now();

update public.profiles
set unit_id = (select id from public.units where code = 'SCTW')
where unit_id is null;

update public.batches
set unit_id = (select id from public.units where code = 'SCTW')
where unit_id is null;

update public.requests r
set unit_id = p.unit_id
from public.profiles p
where r.requester_id = p.id and r.unit_id is null;

update public.strength_records s
set unit_id = p.unit_id
from public.profiles p
where s.profile_id = p.id and s.unit_id is null;

alter table public.batches alter column unit_id set not null;
alter table public.requests alter column unit_id set not null;
alter table public.strength_records alter column unit_id set not null;

create or replace function public.enforce_batch_training_unit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.units child
    where child.parent_unit_id = new.unit_id and child.active = true
  ) then
    raise exception 'Batches cannot be assigned to parent units';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_batch_training_unit on public.batches;
create trigger enforce_batch_training_unit
before insert or update of unit_id on public.batches
for each row execute function public.enforce_batch_training_unit();

create table if not exists public.unit_memberships (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  membership_role text not null default 'member',
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, unit_id),
  constraint unit_memberships_role_check check (membership_role in ('member', 'unit_viewer', 'unit_admin'))
);

alter table public.unit_memberships add column if not exists membership_role text not null default 'member';
alter table public.unit_memberships add column if not exists starts_at date;
alter table public.unit_memberships add column if not exists ends_at date;
alter table public.unit_memberships add column if not exists created_at timestamptz not null default now();
alter table public.unit_memberships add column if not exists updated_at timestamptz not null default now();

insert into public.unit_memberships (profile_id, unit_id, membership_role)
select p.id, p.unit_id, 'member'
from public.profiles p
where p.unit_id is not null and p.role = 'user'
on conflict (profile_id, unit_id) do nothing;

insert into public.unit_memberships (profile_id, unit_id, membership_role)
select p.id, (select id from public.units where code = 'SI'), 'unit_admin'
from public.profiles p
where p.role = 'admin'
  and not exists (
    select 1 from public.unit_memberships membership
    where membership.profile_id = p.id
      and membership.membership_role in ('unit_viewer', 'unit_admin')
  )
on conflict (profile_id, unit_id) do nothing;

alter table public.strength_records drop constraint if exists strength_records_category_check;
alter table public.strength_records
  add constraint strength_records_category_check
  check (category in ('guard_duty', 'on_medication', 'others', 'stay_in_perm_staff'));

create index if not exists requests_requester_email_idx on public.requests (requester_email);
create index if not exists requests_kind_status_idx on public.requests (kind, status);
create index if not exists request_updates_request_id_idx on public.request_updates (request_id, kind);
create unique index if not exists request_updates_request_id_kind_unique_idx on public.request_updates (request_id, kind);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_unit_id_idx on public.profiles (unit_id);
create index if not exists requests_unit_updated_idx on public.requests (unit_id, updated_at desc);
create index if not exists batches_unit_name_idx on public.batches (unit_id, name);
create index if not exists unit_memberships_unit_role_idx on public.unit_memberships (unit_id, membership_role);
create index if not exists strength_records_duty_date_idx on public.strength_records (duty_date, category);
create unique index if not exists strength_records_category_profile_date_unique_idx on public.strength_records (category, profile_id, duty_date);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-attachments',
  'request-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

create or replace function public.is_unit_ancestor(p_ancestor_unit_id uuid, p_unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with recursive ancestors as (
    select id, parent_unit_id from public.units where id = p_unit_id
    union all
    select u.id, u.parent_unit_id
    from public.units u
    join ancestors a on a.parent_unit_id = u.id
  )
  select exists (select 1 from ancestors where id = p_ancestor_unit_id);
$$;

create or replace function public.can_view_unit(p_unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(exists (
    select 1
    from public.profiles p
    join public.unit_memberships membership on membership.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'::public.app_role
      and membership.membership_role in ('unit_viewer', 'unit_admin')
      and (membership.starts_at is null or membership.starts_at <= current_date)
      and (membership.ends_at is null or membership.ends_at >= current_date)
      and public.is_unit_ancestor(membership.unit_id, p_unit_id)
  ), false);
$$;

create or replace function public.can_manage_unit(p_unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(exists (
    select 1
    from public.profiles p
    join public.unit_memberships membership on membership.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'::public.app_role
      and membership.membership_role = 'unit_admin'
      and (membership.starts_at is null or membership.starts_at <= current_date)
      and (membership.ends_at is null or membership.ends_at >= current_date)
      and public.is_unit_ancestor(membership.unit_id, p_unit_id)
  ), false);
$$;

create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
    and auth.uid() = old.id
    and not public.can_manage_unit(old.unit_id)
    and (new.role is distinct from old.role or new.unit_id is distinct from old.unit_id)
  then
    raise exception 'Profile access fields can only be changed by an authorized administrator';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, unit_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'user'::public.app_role,
    (select id from public.units where code = 'SCTW')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  insert into public.unit_memberships (profile_id, unit_id, membership_role)
  select new.id, p.unit_id, 'member'
  from public.profiles p
  where p.id = new.id and p.unit_id is not null
  on conflict (profile_id, unit_id) do nothing;

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

drop trigger if exists protect_profiles_access_fields on public.profiles;
create trigger protect_profiles_access_fields
before update on public.profiles
for each row execute function public.protect_profile_access_fields();

drop trigger if exists set_units_updated_at on public.units;
create trigger set_units_updated_at
before update on public.units
for each row execute function public.set_updated_at();

drop trigger if exists set_unit_memberships_updated_at on public.unit_memberships;
create trigger set_unit_memberships_updated_at
before update on public.unit_memberships
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

drop trigger if exists set_strength_records_updated_at on public.strength_records;
create trigger set_strength_records_updated_at
before update on public.strength_records
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.units enable row level security;
alter table public.unit_memberships enable row level security;
alter table public.requests enable row level security;
alter table public.request_updates enable row level security;
alter table public.request_events enable row level security;
alter table public.batches enable row level security;
alter table public.strength_records enable row level security;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "requests self read" on public.requests;
drop policy if exists "requests self insert" on public.requests;
drop policy if exists "requests self update" on public.requests;
drop policy if exists "requests report sick followup update" on public.requests;
drop policy if exists "requests admin delete" on public.requests;
drop policy if exists "request updates read" on public.request_updates;
drop policy if exists "request updates requester insert" on public.request_updates;
drop policy if exists "request updates requester update" on public.request_updates;
drop policy if exists "request updates admin" on public.request_updates;
drop policy if exists "events read" on public.request_events;
drop policy if exists "events insert admin" on public.request_events;
drop policy if exists "batches read admin" on public.batches;
drop policy if exists "batches write admin" on public.batches;
drop policy if exists "strength records read admin" on public.strength_records;
drop policy if exists "strength records write admin" on public.strength_records;
drop policy if exists "units authenticated read" on public.units;
drop policy if exists "units admin write" on public.units;
drop policy if exists "units admin insert" on public.units;
drop policy if exists "unit memberships read" on public.unit_memberships;
drop policy if exists "unit memberships write" on public.unit_memberships;

create policy "units authenticated read" on public.units
for select to authenticated using (true);

create policy "units admin write" on public.units
for update using (public.can_manage_unit(id))
with check (parent_unit_id is null or public.can_manage_unit(parent_unit_id));

create policy "units admin insert" on public.units
for insert with check (parent_unit_id is not null and public.can_manage_unit(parent_unit_id));

create policy "unit memberships read" on public.unit_memberships
for select using (profile_id = auth.uid() or public.can_view_unit(unit_id));

create policy "unit memberships write" on public.unit_memberships
for all using (public.can_manage_unit(unit_id))
with check (public.can_manage_unit(unit_id));

create policy "profiles self read" on public.profiles
for select using (auth.uid() = id or public.can_view_unit(unit_id));

create policy "profiles self update" on public.profiles
for update using (auth.uid() = id or public.can_manage_unit(unit_id))
with check (auth.uid() = id or public.can_manage_unit(unit_id));

create policy "requests self read" on public.requests
for select using (requester_id = auth.uid() or public.can_view_unit(unit_id));

create policy "requests self insert" on public.requests
for insert with check (
  (
    requester_id = auth.uid()
    and unit_id = (select p.unit_id from public.profiles p where p.id = auth.uid())
  )
  or (
    public.can_manage_unit(unit_id)
    and exists (
      select 1 from public.profiles requester
      where requester.id = requester_id
        and requester.role = 'user'::public.app_role
        and requester.unit_id = unit_id
    )
  )
);

create policy "requests self update" on public.requests
for update using ((requester_id = auth.uid() and status in ('draft', 'pending', 'needs_changes')) or public.can_manage_unit(unit_id))
with check ((requester_id = auth.uid() and status in ('draft', 'pending', 'needs_changes')) or public.can_manage_unit(unit_id));

create policy "requests admin delete" on public.requests
for delete using (public.can_manage_unit(unit_id));

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
    or public.can_view_unit(r.unit_id)
  )
));

create policy "request updates requester insert" on public.request_updates
for insert with check (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.requester_id = auth.uid()
      and (
        (r.kind = 'report_sick'::public.request_kind and r.status in ('approved', 'submitted', 'needs_changes'))
        or (r.kind = 'external_appointment'::public.request_kind and r.status = 'pending')
      )
  )
);

create policy "request updates requester update" on public.request_updates
for update using (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.requester_id = auth.uid()
      and (
        (r.kind = 'report_sick'::public.request_kind and r.status in ('approved', 'submitted', 'needs_changes'))
        or (r.kind = 'external_appointment'::public.request_kind and r.status = 'pending')
      )
  )
)
with check (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.requester_id = auth.uid()
      and (
        (r.kind = 'report_sick'::public.request_kind and r.status in ('approved', 'submitted', 'needs_changes'))
        or (r.kind = 'external_appointment'::public.request_kind and r.status = 'pending')
      )
  )
);

create policy "request updates admin" on public.request_updates
for all using (exists (
  select 1 from public.requests r where r.id = request_id and public.can_manage_unit(r.unit_id)
))
with check (exists (
  select 1 from public.requests r where r.id = request_id and public.can_manage_unit(r.unit_id)
));

create policy "events read" on public.request_events
for select using (exists (
  select 1 from public.requests r
  where r.id = request_id and (
    r.requester_id = auth.uid()
    or public.can_view_unit(r.unit_id)
  )
));

create policy "events insert admin" on public.request_events
for insert with check (exists (
  select 1 from public.requests r where r.id = request_id and public.can_manage_unit(r.unit_id)
));

create policy "batches read admin" on public.batches
for select using (
  public.can_view_unit(unit_id)
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.batch_id = batches.id)
);

create policy "batches write admin" on public.batches
for all using (public.can_manage_unit(unit_id))
with check (public.can_manage_unit(unit_id));

create policy "strength records read admin" on public.strength_records
for select using (public.can_view_unit(unit_id));

create policy "strength records write admin" on public.strength_records
for all using (public.can_manage_unit(unit_id))
with check (
  public.can_manage_unit(unit_id)
  and unit_id = (select p.unit_id from public.profiles p where p.id = profile_id)
);

drop policy if exists "request attachments read" on storage.objects;
drop policy if exists "request attachments insert" on storage.objects;
drop policy if exists "request attachments update" on storage.objects;
drop policy if exists "request attachments delete" on storage.objects;

create policy "request attachments read" on storage.objects
for select to authenticated using (
  bucket_id = 'request-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[2] and public.can_view_unit(r.unit_id)
    )
  )
);

create policy "request attachments insert" on storage.objects
for insert to authenticated with check (
  bucket_id = 'request-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.requester_id = auth.uid()
      and r.kind = 'report_sick'::public.request_kind
      and r.status in ('approved', 'submitted', 'needs_changes')
  )
);

create policy "request attachments update" on storage.objects
for update to authenticated using (
  bucket_id = 'request-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.requester_id = auth.uid()
      and r.kind = 'report_sick'::public.request_kind
      and r.status in ('approved', 'submitted', 'needs_changes')
  )
)
with check (
  bucket_id = 'request-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.requester_id = auth.uid()
      and r.kind = 'report_sick'::public.request_kind
      and r.status in ('approved', 'submitted', 'needs_changes')
  )
);

create policy "request attachments delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'request-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
