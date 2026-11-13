-- =====================================================================
-- Excurso — booking platform for tour & activity operators
-- Postgres / Supabase schema with Row Level Security.
--
-- Security model (read this first):
--   * Every operator's data is isolated by RLS on operator ownership.
--   * The public (anon) can only see what a booking page needs, through
--     column-level grants and SECURITY DEFINER functions.
--   * Billing columns (plan, Stripe ids) can only be written by the server
--     (service_role) — an operator cannot upgrade themselves to "pro".
--   * Seats are reserved inside a transaction that locks the slot row,
--     so two customers can never buy the last seat at the same time.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- types ----------
create type public.plan as enum ('free', 'pro');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'expired', 'needs_refund');

-- ---------- operators (one per business) ----------
create table public.operators (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null unique references auth.users(id) on delete cascade,
  name                   text not null check (char_length(name) between 2 and 80),
  slug                   text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  currency               text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  timezone               text not null default 'Europe/Paris',
  -- billing: server-only (see grants below)
  plan                   public.plan not null default 'free',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  subscription_status    text,
  created_at             timestamptz not null default now()
);

-- ---------- experiences (a tour, a kayak trip, a class...) ----------
create table public.experiences (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null references public.operators(id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 120),
  description      text not null default '' check (char_length(description) <= 4000),
  location         text not null default '' check (char_length(location) <= 200),
  duration_minutes int  not null check (duration_minutes between 15 and 1440),
  price_cents      int  not null check (price_cents between 100 and 10000000),
  deposit_percent  int  not null default 30 check (deposit_percent between 10 and 100),
  default_capacity int  not null default 10 check (default_capacity between 1 and 500),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index on public.experiences (operator_id);

-- ---------- slots (a dated departure of an experience) ----------
create table public.slots (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  operator_id   uuid not null references public.operators(id) on delete cascade,
  starts_at     timestamptz not null,
  capacity      int not null check (capacity between 1 and 500),
  created_at    timestamptz not null default now(),
  unique (experience_id, starts_at)
);
create index on public.slots (experience_id, starts_at);

-- operator_id on slots must match the experience's operator (denormalised for fast RLS)
create function public.slots_set_operator() returns trigger
language plpgsql set search_path = '' as $$
begin
  select e.operator_id into new.operator_id from public.experiences e where e.id = new.experience_id;
  if new.operator_id is null then raise exception 'experience not found'; end if;
  return new;
end $$;
create trigger slots_set_operator before insert or update of experience_id on public.slots
  for each row execute function public.slots_set_operator();

-- ---------- bookings ----------
create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  slot_id           uuid not null references public.slots(id) on delete restrict,
  operator_id       uuid not null references public.operators(id) on delete cascade,
  customer_name     text not null check (char_length(customer_name) between 2 and 100),
  customer_email    text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  seats             int  not null check (seats between 1 and 50),
  amount_cents      int  not null check (amount_cents > 0),
  deposit_cents     int  not null check (deposit_cents > 0 and deposit_cents <= amount_cents),
  status            public.booking_status not null default 'pending',
  stripe_session_id text unique,
  expires_at        timestamptz not null default now() + interval '35 minutes', -- Stripe Checkout sessions last 30 min minimum
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index on public.bookings (slot_id, status);
create index on public.bookings (operator_id, created_at desc);

-- ---------- helpers ----------
-- Is the current user the owner of this operator?
create function public.owns_operator(op uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.operators o where o.id = op and o.owner_id = auth.uid());
$$;

-- Seats held on a slot: confirmed bookings + pending ones that haven't expired.
create function public.seats_taken(p_slot uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(b.seats), 0)::int from public.bookings b
  where b.slot_id = p_slot
    and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()));
$$;

-- Free plan: one active experience. Enforced in the database, not just the UI.
create function public.can_add_experience(op uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select o.plan = 'pro'
      or (select count(*) from public.experiences e where e.operator_id = op) < 1
  from public.operators o where o.id = op;
$$;

-- ---------- RLS ----------
alter table public.operators   enable row level security;
alter table public.experiences enable row level security;
alter table public.slots       enable row level security;
alter table public.bookings    enable row level security;

-- operators
create policy "owner reads own operator"   on public.operators for select to authenticated using (owner_id = auth.uid());
create policy "owner creates own operator" on public.operators for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates own operator" on public.operators for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "public reads operators"     on public.operators for select to anon using (true);

-- experiences
create policy "owner manages experiences" on public.experiences for all to authenticated
  using (public.owns_operator(operator_id)) with check (public.owns_operator(operator_id));
create policy "plan limit on new experiences" on public.experiences as restrictive for insert to authenticated
  with check (public.can_add_experience(operator_id));
create policy "public reads active experiences" on public.experiences for select to anon using (active);

-- slots
create policy "owner manages slots" on public.slots for all to authenticated
  using (public.owns_operator(operator_id)) with check (public.owns_operator(operator_id));
create policy "public reads future slots" on public.slots for select to anon
  using (starts_at > now() and exists (select 1 from public.experiences e where e.id = experience_id and e.active));

-- bookings: owners read and may cancel; nobody else touches them directly.
create policy "owner reads bookings"   on public.bookings for select to authenticated using (public.owns_operator(operator_id));
create policy "owner cancels bookings" on public.bookings for update to authenticated
  using (public.owns_operator(operator_id)) with check (public.owns_operator(operator_id) and status = 'cancelled');

-- ---------- column-level grants (defence in depth) ----------
revoke all on public.operators, public.experiences, public.slots, public.bookings from anon, authenticated;

-- anon: only what a public booking page needs
grant select (id, name, slug, currency, timezone) on public.operators to anon;
grant select (id, operator_id, title, description, location, duration_minutes, price_cents, deposit_percent, active)
  on public.experiences to anon;
grant select (id, experience_id, starts_at, capacity) on public.slots to anon;

-- authenticated owners
grant select on public.operators to authenticated;
grant insert (owner_id, name, slug, currency, timezone) on public.operators to authenticated;
grant update (name, slug, currency, timezone) on public.operators to authenticated;   -- NOT plan / stripe_*
grant select, insert, update, delete on public.experiences to authenticated;
grant select, insert, update, delete on public.slots to authenticated;
grant select on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;

-- ---------- public availability ----------
create function public.slot_availability(p_experience uuid)
returns table (slot_id uuid, starts_at timestamptz, capacity int, seats_left int)
language sql stable security definer set search_path = '' as $$
  select s.id, s.starts_at, s.capacity, greatest(s.capacity - public.seats_taken(s.id), 0)
  from public.slots s
  join public.experiences e on e.id = s.experience_id and e.active
  where s.experience_id = p_experience and s.starts_at > now()
  order by s.starts_at
  limit 200;
$$;
grant execute on function public.slot_availability(uuid) to anon, authenticated;

-- ---------- reserve seats (server only) ----------
-- Locks the slot row so concurrent reservations are serialised.
-- Returns the pending booking; the server then creates the Stripe session.
create function public.reserve_seats(p_slot uuid, p_seats int, p_name text, p_email text)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  s public.slots;
  e public.experiences;
  b public.bookings;
  total int;
begin
  select * into s from public.slots where id = p_slot for update;
  if not found then raise exception 'slot_not_found' using errcode = 'P0002'; end if;
  if s.starts_at <= now() then raise exception 'slot_in_past' using errcode = 'P0001'; end if;

  select * into e from public.experiences where id = s.experience_id;
  if not e.active then raise exception 'experience_inactive' using errcode = 'P0001'; end if;

  if public.seats_taken(p_slot) + p_seats > s.capacity then
    raise exception 'not_enough_seats' using errcode = 'P0001';
  end if;

  total := e.price_cents * p_seats;
  insert into public.bookings (slot_id, operator_id, customer_name, customer_email, seats, amount_cents, deposit_cents)
  values (p_slot, s.operator_id, p_name, lower(p_email), p_seats, total, greatest(50, ceil(total * e.deposit_percent / 100.0)::int))
  returning * into b;
  return b;
end $$;

-- ---------- confirm after payment (webhook, server only) ----------
-- Idempotent: safe to call several times for the same Stripe session.
-- If the hold expired and the seats were sold meanwhile, the booking is
-- flagged for a refund instead of overbooking the slot.
create function public.confirm_booking(p_session text)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  s public.slots;
begin
  select * into b from public.bookings where stripe_session_id = p_session for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if b.status in ('confirmed', 'needs_refund', 'cancelled') then return b; end if;

  select * into s from public.slots where id = b.slot_id for update;
  -- seats_taken() counts this booking only while its hold is valid
  if b.expires_at <= now()
     and public.seats_taken(b.slot_id) + b.seats > s.capacity then
    update public.bookings set status = 'needs_refund' where id = b.id returning * into b;
  else
    update public.bookings set status = 'confirmed', confirmed_at = now() where id = b.id returning * into b;
  end if;
  return b;
end $$;

-- server-only functions
revoke execute on function public.reserve_seats(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.confirm_booking(text) from public, anon, authenticated;
revoke execute on function public.seats_taken(uuid) from public, anon;
grant execute on function public.reserve_seats(uuid, int, text, text) to service_role;
grant execute on function public.confirm_booking(text) to service_role;
grant execute on function public.seats_taken(uuid) to authenticated, service_role;

-- ---------- dashboard stats ----------
create function public.operator_stats(op uuid)
returns table (revenue_cents bigint, deposits_cents bigint, bookings_30d int, seats_30d int, occupancy_pct int, upcoming_slots int)
language sql stable security definer set search_path = '' as $$
  with ok as (select public.owns_operator(op) as yes),
  b as (
    select * from public.bookings
    where operator_id = op and status = 'confirmed' and created_at > now() - interval '30 days'
  ),
  fut as (
    select s.id, s.capacity, public.seats_taken(s.id) as taken
    from public.slots s where s.operator_id = op and s.starts_at > now() and s.starts_at < now() + interval '30 days'
  )
  select
    coalesce((select sum(amount_cents) from b), 0)::bigint,
    coalesce((select sum(deposit_cents) from b), 0)::bigint,
    (select count(*) from b)::int,
    coalesce((select sum(seats) from b), 0)::int,
    coalesce((select (100 * sum(taken) / nullif(sum(capacity), 0)) from fut), 0)::int,
    (select count(*) from fut)::int
  where (select yes from ok);
$$;
grant execute on function public.operator_stats(uuid) to authenticated;
