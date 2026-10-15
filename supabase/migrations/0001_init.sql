-- ============ Tables ============
create table public.households (
  id uuid primary key,
  name text not null default 'My Family',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id) -- one family group per user
);

create table public.household_invites (
  code text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  family_name text not null check (length(btrim(family_name)) > 0),
  primary_person text,
  place text,
  relationship text,
  phone text,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.function_records (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  family_id uuid not null,
  date date not null,
  date_precision text not null check (date_precision in ('DAY', 'YEAR')),
  function_type text not null check (function_type in (
    'WEDDING','ENGAGEMENT','HOUSEWARMING','BABY_FUNCTION','EAR_PIERCING',
    'PUBERTY_CEREMONY','BIRTHDAY','FUNERAL','FESTIVAL','OTHER')),
  function_name text,
  direction text not null check (direction in ('WE_GAVE', 'THEY_GAVE')),
  record_kind text not null default 'MONEY' check (record_kind in ('MONEY', 'GOLD', 'GIFT')),
  amount integer check (amount is null or amount >= 0), -- 0 means "didn't give"
  added_by text,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (family_id, household_id) references public.families(id, household_id)
    on delete cascade on update cascade,
  constraint money_requires_amount check (record_kind <> 'MONEY' or amount is not null)
);

create table public.invitations (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  family_id uuid not null,
  function_type text not null check (function_type in (
    'WEDDING','ENGAGEMENT','HOUSEWARMING','BABY_FUNCTION','EAR_PIERCING',
    'PUBERTY_CEREMONY','BIRTHDAY','FUNERAL','FESTIVAL','OTHER')),
  function_name text,
  function_date date not null,
  function_time time,
  reminders_enabled boolean not null default true,
  reminder_offsets jsonb not null default '["7D","1D","MORNING_OF","EVENING_OF","NEXT_MORNING"]'::jsonb,
  status text not null default 'UPCOMING' check (status in ('UPCOMING', 'ATTENDED', 'SKIPPED')),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (family_id, household_id) references public.families(id, household_id)
    on delete cascade on update cascade
);

-- ============ Helper: is the caller a member of this family group? ============
create or replace function public.is_household_member(h uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = auth.uid()
  );
$$;

-- ============ Last-write-wins guard + server timestamp ============
create or replace function public.sync_row_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null; -- ignore a stale update, keep the newer existing row
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

-- ============ Family group functions (called by the app) ============

-- Start my family group, or return the one I am already in.
create or replace function public.ensure_household(p_id uuid, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  existing uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select household_id into existing
  from public.household_members where user_id = auth.uid();
  if existing is not null then
    return existing;
  end if;

  insert into public.households (id, created_by) values (p_id, auth.uid());
  insert into public.household_members (household_id, user_id, role, display_name)
  values (p_id, auth.uid(), 'owner', nullif(btrim(p_display_name), ''));
  return p_id;
end;
$$;

-- Owner creates a one-time invite code that works for 24 hours.
create or replace function public.create_invite()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  h uuid;
  c text;
begin
  select household_id into h
  from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if h is null then
    raise exception 'only_owner_can_invite';
  end if;

  delete from public.household_invites where household_id = h and expires_at < now();
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.household_invites (code, household_id, expires_at)
  values (c, h, now() + interval '24 hours');
  return c;
end;
$$;

-- Join someone's family group with a code. If I was alone in my own group,
-- my records move into the new group.
create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
  old_h uuid;
  old_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into inv from public.household_invites
  where code = upper(btrim(p_code)) and expires_at > now()
  for update;
  if not found then
    raise exception 'invalid_or_expired_code';
  end if;

  select household_id into old_h
  from public.household_members where user_id = auth.uid();

  if old_h is not null then
    if old_h = inv.household_id then
      return old_h;
    end if;
    select count(*) into old_count
    from public.household_members where household_id = old_h;
    if old_count > 1 then
      raise exception 'leave_current_group_first';
    end if;

    -- Moving families also moves their records and invitations (ON UPDATE CASCADE).
    update public.families set household_id = inv.household_id where household_id = old_h;
    delete from public.household_members where household_id = old_h and user_id = auth.uid();
    delete from public.households where id = old_h;
  end if;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (inv.household_id, auth.uid(), 'member', nullif(btrim(p_display_name), ''));

  delete from public.household_invites where code = inv.code;
  return inv.household_id;
end;
$$;

-- Leave my family group (the group keeps its data). The last member cannot leave.
create or replace function public.leave_household()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  h uuid;
  r text;
  cnt int;
  next_owner uuid;
begin
  select household_id, role into h, r
  from public.household_members where user_id = auth.uid();
  if h is null then
    return;
  end if;

  select count(*) into cnt from public.household_members where household_id = h;
  if cnt = 1 then
    raise exception 'last_member_cannot_leave';
  end if;

  if r = 'owner' then
    select user_id into next_owner
    from public.household_members
    where household_id = h and user_id <> auth.uid()
    order by created_at limit 1;
    update public.household_members set role = 'owner'
    where household_id = h and user_id = next_owner;
  end if;

  delete from public.household_members where household_id = h and user_id = auth.uid();
end;
$$;

-- Server-only: tidy up a user's group before their account is deleted.
create or replace function public.prepare_account_deletion(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  h uuid;
  r text;
  cnt int;
  next_owner uuid;
begin
  select household_id, role into h, r
  from public.household_members where user_id = p_user;
  if h is null then
    return;
  end if;

  select count(*) into cnt from public.household_members where household_id = h;
  if cnt = 1 then
    delete from public.households where id = h; -- the whole group's data, because nobody is left
  else
    if r = 'owner' then
      select user_id into next_owner
      from public.household_members
      where household_id = h and user_id <> p_user
      order by created_at limit 1;
      update public.household_members set role = 'owner'
      where household_id = h and user_id = next_owner;
    end if;
    delete from public.household_members where household_id = h and user_id = p_user;
  end if;
end;
$$;

-- Function permissions: nothing is callable by default.
revoke all on function public.is_household_member(uuid) from public, anon, authenticated;
revoke all on function public.ensure_household(uuid, text) from public, anon, authenticated;
revoke all on function public.create_invite() from public, anon, authenticated;
revoke all on function public.join_household(text, text) from public, anon, authenticated;
revoke all on function public.leave_household() from public, anon, authenticated;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.ensure_household(uuid, text) to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

-- ============ Row Level Security ============
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security; -- no policies: only the functions above can touch it

create policy "members read group" on public.households
  for select to authenticated using (public.is_household_member(id));

create policy "members read members" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

create policy "edit my own display name" on public.household_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.households, public.household_members to authenticated;
grant update (display_name) on public.household_members to authenticated;
grant select, insert, update on public.families, public.function_records, public.invitations to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['families', 'function_records', 'invitations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy "members insert" on public.%I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('create policy "members update" on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create trigger trg_sync_row_guard before insert or update on public.%I for each row execute function public.sync_row_guard()', t);
    execute format('create index %I on public.%I (household_id, server_updated_at, id)', t || '_pull_idx', t);
  end loop;
end;
$$;
