begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
set local search_path = public, extensions;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'orva-owner@test.invalid', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'orva-other@test.invalid', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'orva-joiner@test.invalid', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'orva-invite-test@test.invalid', '', now(), now(), now());

create temporary table test_codes (kind text primary key, code text not null);
grant select, insert on test_codes to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is(public.ensure_household('10000000-0000-0000-0000-000000000001', 'Appa')::text,
  '10000000-0000-0000-0000-000000000001', 'owner can start one family group');

insert into public.families (id, household_id, family_name, created_at, updated_at)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Ravi Family', now(), now());

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is(public.ensure_household('10000000-0000-0000-0000-000000000002', 'Amma')::text,
  '10000000-0000-0000-0000-000000000002', 'another member starts a separate group');
insert into public.families (id, household_id, family_name, created_at, updated_at)
values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Kumar Family', now(), now());
select is((select count(*)::int from public.families where id = '20000000-0000-0000-0000-000000000001'),
  0, 'a different group cannot read the first group family');
select throws_ok($$insert into public.families (id, household_id, family_name, created_at, updated_at)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Intruder', now(), now())$$,
  '42501', 'a non-member cannot insert a family into another group');
select throws_ok($$insert into public.household_members (household_id, user_id, role)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'member')$$,
  '42501', 'a user cannot add themselves as a group member');
select throws_ok($$insert into public.function_records (
  id, household_id, family_id, date, date_precision, function_type, direction, record_kind, amount, created_at, updated_at
) values (
  '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001', '2026-01-01', 'DAY', 'WEDDING', 'WE_GAVE', 'MONEY', 0, now(), now()
)$$, '23503', 'a record cannot reference a family from another group');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(public.ensure_household('10000000-0000-0000-0000-000000000003', 'Ravi')::text,
  '10000000-0000-0000-0000-000000000003', 'a solo member can start a separate group');
insert into public.families (id, household_id, family_name, created_at, updated_at)
values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Suresh Family', now(), now());
insert into public.function_records (
  id, household_id, family_id, date, date_precision, function_type, direction, record_kind, amount, created_at, updated_at
) values (
  '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003', '2025-05-04', 'DAY', 'HOUSEWARMING', 'WE_GAVE', 'MONEY', 2000, now(), now()
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into test_codes values ('join', public.create_invite());
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(public.join_household((select code from test_codes where kind = 'join'), 'Ravi')::text,
  '10000000-0000-0000-0000-000000000001', 'valid invite joins the invited group');
select is((select count(*)::int from public.families where id = '20000000-0000-0000-0000-000000000003'),
  1, 'joining moves the solo member family into the invited group');
select is((select count(*)::int from public.function_records where id = '30000000-0000-0000-0000-000000000002'),
  1, 'joining moves the solo member records into the invited group');
select throws_ok($$select public.create_invite()$$, 'P0001', 'only the owner can create an invite');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select throws_ok($$select public.join_household((select code from test_codes where kind = 'join'), 'Guest')$$,
  'P0001', 'an invite code cannot be used twice');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into test_codes values ('expired', public.create_invite());
reset role;
update public.household_invites set expires_at = now() - interval '1 minute'
where code = (select code from test_codes where kind = 'expired');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select throws_ok($$select public.join_household((select code from test_codes where kind = 'expired'), 'Guest')$$,
  'P0001', 'expired invite codes are rejected');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok($$insert into public.function_records (
  id, household_id, family_id, date, date_precision, function_type, direction, record_kind, amount, created_at, updated_at
) values (
  '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', '2025-01-01', 'YEAR', 'WEDDING', 'THEY_GAVE', 'MONEY', 0, now(), now()
)$$, 'amount zero is accepted');
select throws_ok($$insert into public.function_records (
  id, household_id, family_id, date, date_precision, function_type, direction, record_kind, amount, created_at, updated_at
) values (
  '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', '2025-01-01', 'YEAR', 'WEDDING', 'THEY_GAVE', 'MONEY', -1, now(), now()
)$$, '23514', 'negative amounts are rejected');

update public.families set family_name = 'Newer name', updated_at = '2099-01-02T00:00:00Z'
where id = '20000000-0000-0000-0000-000000000001';
update public.families set family_name = 'Stale name', updated_at = '2099-01-01T00:00:00Z'
where id = '20000000-0000-0000-0000-000000000001';
select is((select family_name from public.families where id = '20000000-0000-0000-0000-000000000001'),
  'Newer name', 'stale updates do not replace a newer row');
select throws_ok($$select public.prepare_account_deletion(auth.uid())$$, '42501',
  'authenticated users cannot call account cleanup');

select public.leave_household();
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select role from public.household_members where user_id = '00000000-0000-0000-0000-000000000003'),
  'owner', 'ownership transfers when the owner leaves');
select throws_ok($$select public.leave_household()$$, 'P0001', 'the final member cannot leave');

select * from finish();
rollback;
