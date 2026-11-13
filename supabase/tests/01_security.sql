-- Security & correctness tests for the Excurso schema.
-- Each block raises an exception (and stops the run) if a guarantee breaks.
\set ON_ERROR_STOP on
\set QUIET on

-- fixtures ------------------------------------------------------------
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'alice@op.test'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@op.test');

create or replace function test_as(role_name text, uid text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  execute format('set role %I', role_name);
end $$;
grant execute on function test_as(text, text) to anon, authenticated, service_role;

-- Alice creates her business, an experience and a slot (as herself)
select test_as('authenticated', '00000000-0000-0000-0000-00000000000a');
insert into operators (owner_id, name, slug) values ('00000000-0000-0000-0000-00000000000a', 'Annaba Kayak', 'annaba-kayak');
insert into experiences (operator_id, title, duration_minutes, price_cents, deposit_percent, default_capacity)
  select id, 'Sunset kayak', 120, 4000, 25, 4 from operators where slug = 'annaba-kayak';
insert into slots (experience_id, operator_id, starts_at, capacity)
  select e.id, gen_random_uuid(), now() + interval '3 days', 4 from experiences e;  -- operator_id is overwritten by trigger
reset role;

-- Bob has his own business
select test_as('authenticated', '00000000-0000-0000-0000-00000000000b');
insert into operators (owner_id, name, slug) values ('00000000-0000-0000-0000-00000000000b', 'Bob Tours', 'bob-tours');
reset role;

\echo '1. trigger fixes a forged operator_id on slots'
do $$ begin
  if exists (select 1 from slots s join experiences e on e.id = s.experience_id where s.operator_id <> e.operator_id)
  then raise exception 'FAIL: slot operator_id not taken from experience'; end if;
end $$;

\echo '2. operators cannot read each other'
select test_as('authenticated', '00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from operators) <> 1 then raise exception 'FAIL: Bob sees other operators'; end if;
  if (select count(*) from experiences) <> 0 then raise exception 'FAIL: Bob sees Alice''s experiences'; end if;
end $$;

\echo '3. operators cannot write into each other'
do $$ begin
  begin
    insert into experiences (operator_id, title, duration_minutes, price_cents)
      select id, 'Hijack', 60, 1000 from operators where slug = 'annaba-kayak';
    -- Bob can't even see Alice's operator row, so nothing is inserted
    if (select count(*) from experiences where title = 'Hijack') > 0 then raise exception 'FAIL: hijack insert'; end if;
  end;
  begin
    insert into experiences (operator_id, title, duration_minutes, price_cents)
      values ((select id from public.operators where false), 'x', 60, 1000);
  exception when others then null; end;
end $$;
reset role;
do $$ declare alice uuid := (select id from operators where slug = 'annaba-kayak'); begin
  perform test_as('authenticated', '00000000-0000-0000-0000-00000000000b');
  begin
    execute format('insert into experiences (operator_id, title, duration_minutes, price_cents) values (%L, %L, 60, 1000)', alice, 'Hijack 2');
    raise exception 'FAIL: Bob inserted into Alice''s operator';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

\echo '4. an operator cannot upgrade themselves to pro (column grants)'
select test_as('authenticated', '00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    update operators set plan = 'pro';
    raise exception 'FAIL: operator changed own plan';
  exception when insufficient_privilege then null; end;
  begin
    update operators set stripe_customer_id = 'cus_fake';
    raise exception 'FAIL: operator changed stripe id';
  exception when insufficient_privilege then null; end;
end $$;

\echo '5. free plan is limited to one experience (enforced by RLS)'
do $$ begin
  begin
    insert into experiences (operator_id, title, duration_minutes, price_cents)
      select id, 'Second trip', 60, 1000 from operators;
    raise exception 'FAIL: free plan created a second experience';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update operators set plan = 'pro' where slug = 'annaba-kayak';  -- as the server would after payment
select test_as('authenticated', '00000000-0000-0000-0000-00000000000a');
insert into experiences (operator_id, title, duration_minutes, price_cents) select id, 'Second trip', 60, 1000 from operators;
reset role;

\echo '6. anon sees public columns only, and no bookings'
select test_as('anon');
do $$ begin
  if (select count(*) from operators) <> 2 then raise exception 'FAIL: anon cannot list operators'; end if;
  begin
    perform stripe_customer_id from operators;
    raise exception 'FAIL: anon read stripe_customer_id';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from bookings;
    raise exception 'FAIL: anon read bookings';
  exception when insufficient_privilege then null; end;
  begin
    perform reserve_seats(gen_random_uuid(), 1, 'x', 'x@y.z');
    raise exception 'FAIL: anon called reserve_seats';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo '7. capacity is never exceeded'
select test_as('service_role');
do $$ declare s uuid := (select id from slots limit 1); b bookings; begin
  b := reserve_seats(s, 3, 'Sara', 'SARA@mail.test');
  if b.customer_email <> 'sara@mail.test' then raise exception 'FAIL: email not normalised'; end if;
  if b.amount_cents <> 12000 or b.deposit_cents <> 3000 then raise exception 'FAIL: wrong price %/%', b.amount_cents, b.deposit_cents; end if;
  begin
    perform reserve_seats(s, 2, 'Late', 'late@mail.test');
    raise exception 'FAIL: overbooked (3 held + 2 > 4)';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_enough_seats' then raise; end if;
  end;
  perform reserve_seats(s, 1, 'Last', 'last@mail.test');  -- exactly fills the slot
  if seats_taken(s) <> 4 then raise exception 'FAIL: seats_taken = %', seats_taken(s); end if;
end $$;

\echo '8. expired holds release their seats'
do $$ declare s uuid := (select id from slots limit 1); begin
  update bookings set expires_at = now() - interval '1 minute' where customer_name = 'Last';
  if seats_taken(s) <> 3 then raise exception 'FAIL: expired hold still counted'; end if;
  if (select seats_left from slot_availability((select experience_id from slots where id = s))) <> 1
  then raise exception 'FAIL: availability wrong'; end if;
end $$;

\echo '9. confirm_booking is idempotent'
do $$ declare b bookings; begin
  update bookings set stripe_session_id = 'cs_test_sara' where customer_name = 'Sara';
  b := confirm_booking('cs_test_sara');
  if b.status <> 'confirmed' then raise exception 'FAIL: not confirmed'; end if;
  b := confirm_booking('cs_test_sara');
  if b.status <> 'confirmed' then raise exception 'FAIL: second call changed status'; end if;
end $$;

\echo '10. a payment arriving after the hold expired never overbooks'
do $$ declare s uuid := (select id from slots limit 1); b bookings; begin
  -- 'Last' hold expired (test 8); someone else takes the freed seat
  perform reserve_seats(s, 1, 'Newer', 'newer@mail.test');
  update bookings set stripe_session_id = 'cs_test_last' where customer_name = 'Last';
  b := confirm_booking('cs_test_last');
  if b.status <> 'needs_refund' then raise exception 'FAIL: late payment confirmed into a full slot (%)', b.status; end if;
end $$;
reset role;

\echo '11. owner can cancel but not forge a confirmation'
select test_as('authenticated', '00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    update bookings set status = 'confirmed' where customer_name = 'Newer';
    raise exception 'FAIL: owner confirmed a booking without payment';
  exception when check_violation or insufficient_privilege then null; end;
  begin
    update bookings set amount_cents = 1 where customer_name = 'Sara';
    raise exception 'FAIL: owner edited amount';
  exception when insufficient_privilege then null; end;
  update bookings set status = 'cancelled' where customer_name = 'Newer';
end $$;
select test_as('authenticated', '00000000-0000-0000-0000-00000000000b');
do $$ begin
  update bookings set status = 'cancelled' where customer_name = 'Sara';
  reset role;
  if (select status from bookings where customer_name = 'Sara') <> 'confirmed' then raise exception 'FAIL: Bob cancelled Alice''s booking'; end if;
end $$;
reset role;

\echo '12. stats are private to the owner'
do $$ declare op uuid := (select id from operators where slug = 'annaba-kayak'); r record; begin
  perform test_as('authenticated', '00000000-0000-0000-0000-00000000000a');
  select * into r from operator_stats(op);
  if r.revenue_cents <> 12000 or r.bookings_30d <> 1 then raise exception 'FAIL: stats % %', r.revenue_cents, r.bookings_30d; end if;
  perform test_as('authenticated', '00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from operator_stats(op)) then raise exception 'FAIL: Bob read Alice''s stats'; end if;
  reset role;
end $$;

\echo 'ALL DATABASE TESTS PASSED'
