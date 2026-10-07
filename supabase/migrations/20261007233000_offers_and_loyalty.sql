-- Deals, sales, announcements, and visit rewards.
-- Clients need an account to read announcements and claim offers.
-- Visit rewards unlock after the number of completed appointments Aviva sets.

do $$ begin
  create type public.offer_kind as enum ('deal', 'sale', 'announcement', 'reward');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.offer_claim_status as enum ('claimed', 'redeemed');
exception when duplicate_object then null;
end $$;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind public.offer_kind not null default 'deal',
  highlight text,
  visits_required integer check (visits_required is null or visits_required > 0),
  published boolean not null default false,
  starts_on date,
  ends_on date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.offer_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.offer_claim_status not null default 'claimed',
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (offer_id, user_id)
);

create index if not exists offers_published_idx on public.offers (published, kind);
create index if not exists offer_claims_user_idx on public.offer_claims (user_id);

drop trigger if exists offers_updated_at on public.offers;
create trigger offers_updated_at before update on public.offers
for each row execute function public.set_updated_at();

create or replace function public.offer_is_live(p public.offers)
returns boolean
language sql
stable
as $$
  select p.published
    and (p.starts_on is null or p.starts_on <= current_date)
    and (p.ends_on is null or p.ends_on >= current_date);
$$;

create or replace function public.my_completed_visits()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.bookings b
  join public.clients c on c.id = b.client_id
  where c.auth_user_id = auth.uid()
    and b.status = 'completed';
$$;

create or replace function public.claim_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_visits integer;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Create an account to claim this offer';
  end if;

  select * into v_offer from public.offers where id = p_offer_id;
  if not found or not public.offer_is_live(v_offer) then
    raise exception 'This offer is not available';
  end if;
  if v_offer.kind = 'announcement' then
    raise exception 'Announcements do not need to be claimed';
  end if;

  if exists (
    select 1 from public.offer_claims
    where offer_id = p_offer_id and user_id = auth.uid()
  ) then
    raise exception 'You have already claimed this offer';
  end if;

  if v_offer.visits_required is not null then
    v_visits := public.my_completed_visits();
    if v_visits < v_offer.visits_required then
      raise exception 'You need % completed visits to claim this. You have %.',
        v_offer.visits_required, v_visits;
    end if;
  end if;

  insert into public.offer_claims (offer_id, user_id, status)
  values (p_offer_id, auth.uid(), 'claimed')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_offer_teasers()
returns table (
  id uuid,
  title text,
  highlight text,
  kind text
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.title, o.highlight, o.kind::text
  from public.offers o
  where public.offer_is_live(o)
    and o.kind in ('deal', 'sale')
  order by o.sort_order, o.created_at desc;
$$;

revoke all on function public.my_completed_visits() from public;
revoke all on function public.claim_offer(uuid) from public;
revoke all on function public.list_offer_teasers() from public;
grant execute on function public.my_completed_visits() to authenticated;
grant execute on function public.claim_offer(uuid) to authenticated;
grant execute on function public.list_offer_teasers() to anon, authenticated;

alter table public.offers enable row level security;
alter table public.offer_claims enable row level security;

drop policy if exists offers_member_read on public.offers;
create policy offers_member_read on public.offers
  for select to authenticated
  using (public.is_staff() or public.offer_is_live(offers));

drop policy if exists offers_staff_write on public.offers;
create policy offers_staff_write on public.offers
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists offer_claims_select on public.offer_claims;
create policy offer_claims_select on public.offer_claims
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists offer_claims_staff_update on public.offer_claims;
create policy offer_claims_staff_update on public.offer_claims
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists offer_claims_staff_delete on public.offer_claims;
create policy offer_claims_staff_delete on public.offer_claims
  for delete to authenticated
  using (public.is_staff());
