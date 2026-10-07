-- Released availability slots, holds, and slot-based booking requests

do $$ begin
  create type public.slot_appointment_type as enum ('home_visit', 'wig', 'both');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.slot_status as enum (
    'available',
    'held',
    'requested',
    'confirmed',
    'blocked',
    'removed',
    'completed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  appointment_type public.slot_appointment_type not null default 'both',
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  travel_buffer_minutes integer not null default 30 check (travel_buffer_minutes >= 0),
  status public.slot_status not null default 'available',
  service_id uuid references public.services (id) on delete set null,
  admin_note text,
  held_until timestamptz,
  held_by uuid references auth.users (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- Optional multi-service restrictions (empty = general / open to matching type)
create table if not exists public.availability_slot_services (
  slot_id uuid not null references public.availability_slots (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (slot_id, service_id)
);

alter table public.bookings
  add column if not exists availability_slot_id uuid references public.availability_slots (id) on delete set null;

create index if not exists availability_slots_date_idx on public.availability_slots (slot_date);
create index if not exists availability_slots_status_idx on public.availability_slots (status);
create index if not exists availability_slots_date_time_idx on public.availability_slots (slot_date, start_time);
create index if not exists bookings_availability_slot_id_idx on public.bookings (availability_slot_id);

-- One active booking per slot (prevents double booking at DB level)
create unique index if not exists availability_slots_one_active_booking
  on public.availability_slots (id)
  where status in ('held', 'requested', 'confirmed') and booking_id is not null;

drop trigger if exists availability_slots_updated_at on public.availability_slots;
create trigger availability_slots_updated_at before update on public.availability_slots
for each row execute function public.set_updated_at();

-- Expire stale holds before reads/writes
create or replace function public.expire_stale_holds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.availability_slots
  set
    status = 'available',
    held_until = null,
    held_by = null,
    booking_id = null,
    updated_at = now()
  where status = 'held'
    and held_until is not null
    and held_until < now();
end;
$$;

create or replace function public.slot_is_bookable(p_slot public.availability_slots)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_slot.status = 'available' then
    return true;
  end if;
  if p_slot.status = 'held' and (p_slot.held_until is null or p_slot.held_until < now()) then
    return true;
  end if;
  return false;
end;
$$;

-- Public: list released slots (available / expired holds only)
create or replace function public.get_released_availability(
  p_booking_type public.booking_type default null,
  p_service_id uuid default null,
  p_from_date date default current_date,
  p_to_date date default (current_date + 90)
)
returns table (
  id uuid,
  slot_date date,
  start_time time,
  end_time time,
  appointment_type public.slot_appointment_type,
  duration_minutes integer,
  travel_buffer_minutes integer,
  status public.slot_status,
  service_id uuid,
  service_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_stale_holds();

  return query
  select
    s.id,
    s.slot_date,
    s.start_time,
    s.end_time,
    s.appointment_type,
    s.duration_minutes,
    s.travel_buffer_minutes,
    s.status,
    s.service_id,
    coalesce(
      (select array_agg(ass.service_id) from public.availability_slot_services ass where ass.slot_id = s.id),
      case when s.service_id is not null then array[s.service_id] else '{}'::uuid[] end
    ) as service_ids
  from public.availability_slots s
  where s.slot_date between p_from_date and p_to_date
    and public.slot_is_bookable(s)
    and (
      p_booking_type is null
      or s.appointment_type = 'both'
      or (p_booking_type = 'home_visit' and s.appointment_type = 'home_visit')
      or (p_booking_type = 'wig' and s.appointment_type = 'wig')
    )
    and (
      p_service_id is null
      or (
        s.service_id is null
        and not exists (select 1 from public.availability_slot_services ass where ass.slot_id = s.id)
      )
      or s.service_id = p_service_id
      or exists (
        select 1 from public.availability_slot_services ass
        where ass.slot_id = s.id and ass.service_id = p_service_id
      )
    )
  order by s.slot_date, s.start_time;
end;
$$;

-- Staff: release one or many slots
create or replace function public.release_availability_slots(
  p_dates date[],
  p_times time[],
  p_appointment_type public.slot_appointment_type default 'both',
  p_duration_minutes integer default 60,
  p_travel_buffer_minutes integer default null,
  p_service_ids uuid[] default '{}',
  p_admin_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_time time;
  v_end time;
  v_buffer integer;
  v_slot_id uuid;
  v_count integer := 0;
  v_svc uuid;
begin
  if not public.is_staff() then
    raise exception 'Staff only';
  end if;
  if p_dates is null or array_length(p_dates, 1) is null then
    raise exception 'At least one date is required';
  end if;
  if p_times is null or array_length(p_times, 1) is null then
    raise exception 'At least one time is required';
  end if;

  select coalesce(p_travel_buffer_minutes, default_travel_buffer_minutes, 30)
  into v_buffer
  from public.business_settings where id = 1;
  v_buffer := coalesce(v_buffer, 30);

  foreach v_date in array p_dates loop
    foreach v_time in array p_times loop
      v_end := (v_time + make_interval(mins => greatest(p_duration_minutes, 15)))::time;

      -- Skip exact duplicate available/held slots for same date+start
      if exists (
        select 1 from public.availability_slots s
        where s.slot_date = v_date
          and s.start_time = v_time
          and s.status not in ('removed', 'completed')
      ) then
        continue;
      end if;

      insert into public.availability_slots (
        slot_date, start_time, end_time, appointment_type,
        duration_minutes, travel_buffer_minutes, status, admin_note,
        service_id
      ) values (
        v_date, v_time, v_end, p_appointment_type,
        greatest(p_duration_minutes, 15), v_buffer, 'available', p_admin_note,
        case when array_length(p_service_ids, 1) = 1 then p_service_ids[1] else null end
      )
      returning id into v_slot_id;

      if p_service_ids is not null then
        foreach v_svc in array p_service_ids loop
          if v_svc is not null then
            insert into public.availability_slot_services (slot_id, service_id)
            values (v_slot_id, v_svc)
            on conflict do nothing;
          end if;
        end loop;
      end if;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- Temporarily hold a slot (server-side)
create or replace function public.hold_availability_slot(
  p_slot_id uuid,
  p_hold_minutes integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.availability_slots%rowtype;
begin
  perform public.expire_stale_holds();

  select * into v_slot
  from public.availability_slots
  where id = p_slot_id
  for update;

  if not found then
    return false;
  end if;

  if not public.slot_is_bookable(v_slot) then
    -- Allow re-hold by same user
    if v_slot.status = 'held' and v_slot.held_by = auth.uid() and v_slot.held_until > now() then
      update public.availability_slots
      set held_until = now() + make_interval(mins => greatest(p_hold_minutes, 1))
      where id = p_slot_id;
      return true;
    end if;
    return false;
  end if;

  update public.availability_slots
  set
    status = 'held',
    held_until = now() + make_interval(mins => greatest(coalesce(p_hold_minutes, 10), 1)),
    held_by = auth.uid(),
    updated_at = now()
  where id = p_slot_id;

  return true;
end;
$$;

create or replace function public.release_slot_hold(p_slot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.availability_slots
  set
    status = 'available',
    held_until = null,
    held_by = null,
    booking_id = null,
    updated_at = now()
  where id = p_slot_id
    and status = 'held'
    and (held_by = auth.uid() or public.is_staff() or held_by is null);

  return found;
end;
$$;

-- Slot-based booking request (replaces free date/time for website bookings)
create or replace function public.submit_slot_booking_request(
  p_slot_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_service_id uuid,
  p_booking_type public.booking_type,
  p_suburb text default null,
  p_customer_address text default null,
  p_number_of_people integer default 1,
  p_customer_notes text default null,
  p_preferred_contact text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.availability_slots%rowtype;
  v_client_id uuid;
  v_booking_id uuid;
  v_settings public.business_settings%rowtype;
  v_buffer integer;
  v_existing_client uuid;
begin
  perform public.expire_stale_holds();

  select * into v_settings from public.business_settings where id = 1;
  if not found or v_settings.accept_bookings is not true then
    raise exception 'Bookings are not currently accepted';
  end if;
  if p_booking_type = 'home_visit' and v_settings.home_visits_enabled is not true then
    raise exception 'Home visits are not currently available';
  end if;
  if p_booking_type = 'wig' and v_settings.wig_appointments_enabled is not true then
    raise exception 'Wig appointments are not currently available';
  end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'Name is required';
  end if;

  select * into v_slot
  from public.availability_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'That appointment time is no longer available';
  end if;

  if not public.slot_is_bookable(v_slot)
     and not (v_slot.status = 'held' and (v_slot.held_by = auth.uid() or v_slot.held_by is null)) then
    raise exception 'That appointment time is no longer available';
  end if;

  -- Type match
  if v_slot.appointment_type <> 'both'
     and (
       (p_booking_type = 'home_visit' and v_slot.appointment_type <> 'home_visit')
       or (p_booking_type = 'wig' and v_slot.appointment_type <> 'wig')
     ) then
    raise exception 'This time is not available for the selected appointment type';
  end if;

  -- Service restriction
  if p_service_id is not null then
    if v_slot.service_id is not null and v_slot.service_id <> p_service_id then
      raise exception 'This time is not available for the selected service';
    end if;
    if exists (select 1 from public.availability_slot_services where slot_id = v_slot.id)
       and not exists (
         select 1 from public.availability_slot_services
         where slot_id = v_slot.id and service_id = p_service_id
       ) then
      raise exception 'This time is not available for the selected service';
    end if;
  end if;

  v_buffer := coalesce(v_slot.travel_buffer_minutes, v_settings.default_travel_buffer_minutes, 30);

  -- Prefer existing CRM client for logged-in user
  v_existing_client := null;
  if auth.uid() is not null then
    select id into v_existing_client from public.clients where auth_user_id = auth.uid() limit 1;
  end if;

  if v_existing_client is not null then
    v_client_id := v_existing_client;
    update public.clients
    set
      full_name = coalesce(nullif(trim(full_name), ''), trim(p_full_name)),
      email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email),
      phone = coalesce(nullif(trim(coalesce(p_phone, '')), ''), phone),
      suburb = coalesce(nullif(trim(coalesce(p_suburb, '')), ''), suburb),
      preferred_contact = coalesce(p_preferred_contact, preferred_contact)
    where id = v_client_id;
  else
    insert into public.clients (full_name, email, phone, suburb, preferred_contact, auth_user_id)
    values (
      trim(p_full_name),
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_suburb, '')), ''),
      p_preferred_contact,
      auth.uid()
    )
    returning id into v_client_id;
  end if;

  insert into public.bookings (
    client_id, service_id, created_by, booking_source, booking_type,
    requested_date, requested_time,
    suburb, customer_address, number_of_people, customer_notes,
    travel_buffer_minutes, status, availability_slot_id
  ) values (
    v_client_id, p_service_id, auth.uid(), 'website', p_booking_type,
    v_slot.slot_date, v_slot.start_time,
    nullif(trim(coalesce(p_suburb, '')), ''),
    case when p_booking_type = 'home_visit' then nullif(trim(coalesce(p_customer_address, '')), '') else null end,
    greatest(coalesce(p_number_of_people, 1), 1),
    p_customer_notes,
    v_buffer,
    'requested',
    v_slot.id
  )
  returning id into v_booking_id;

  update public.availability_slots
  set
    status = 'requested',
    booking_id = v_booking_id,
    held_until = null,
    held_by = auth.uid(),
    updated_at = now()
  where id = v_slot.id;

  return v_booking_id;
end;
$$;

-- Staff: confirm booking + slot together
create or replace function public.confirm_slot_booking(
  p_booking_id uuid,
  p_client_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_duration integer;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Staff only';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  select coalesce(s.duration_minutes, 60) into v_duration
  from public.services s where s.id = v_booking.service_id;
  v_duration := coalesce(v_duration, 60);

  if v_booking.requested_date is null or v_booking.requested_time is null then
    raise exception 'Booking has no requested time';
  end if;

  v_start := (v_booking.requested_date + v_booking.requested_time)::timestamptz;
  v_end := v_start + make_interval(mins => v_duration);

  update public.bookings
  set
    status = 'confirmed',
    confirmed_start = v_start,
    confirmed_end = v_end,
    client_message = coalesce(p_client_message, client_message),
    updated_at = now()
  where id = p_booking_id;

  if v_booking.availability_slot_id is not null then
    update public.availability_slots
    set status = 'confirmed', booking_id = p_booking_id, held_until = null, updated_at = now()
    where id = v_booking.availability_slot_id;
  end if;

  return true;
end;
$$;

-- Staff: decline booking; optionally re-release the slot
create or replace function public.decline_slot_booking(
  p_booking_id uuid,
  p_rerelease_slot boolean default true,
  p_client_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Staff only';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  update public.bookings
  set
    status = 'declined',
    client_message = coalesce(p_client_message, client_message),
    updated_at = now()
  where id = p_booking_id;

  if v_booking.availability_slot_id is not null then
    if p_rerelease_slot then
      update public.availability_slots
      set status = 'available', booking_id = null, held_until = null, held_by = null, updated_at = now()
      where id = v_booking.availability_slot_id;
    else
      update public.availability_slots
      set status = 'removed', updated_at = now()
      where id = v_booking.availability_slot_id;
    end if;
  end if;

  return true;
end;
$$;

-- Staff: complete booking
create or replace function public.complete_slot_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Staff only';
  end if;

  update public.bookings
  set status = 'completed', updated_at = now()
  where id = p_booking_id
  returning availability_slot_id into v_slot_id;

  if v_slot_id is not null then
    update public.availability_slots
    set status = 'completed', updated_at = now()
    where id = v_slot_id;
  end if;

  return true;
end;
$$;

-- Client reschedule request against a released slot
create or replace function public.request_slot_reschedule(
  p_booking_id uuid,
  p_new_slot_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot public.availability_slots%rowtype;
  v_owns boolean;
begin
  perform public.expire_stale_holds();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  select exists (
    select 1 from public.clients c
    where c.id = v_booking.client_id and c.auth_user_id = auth.uid()
  ) into v_owns;

  if not v_owns and not public.is_staff() then
    raise exception 'Not allowed';
  end if;

  select * into v_slot from public.availability_slots where id = p_new_slot_id for update;
  if not found or not public.slot_is_bookable(v_slot) then
    raise exception 'That appointment time is no longer available';
  end if;

  update public.bookings
  set
    status = 'reschedule_requested',
    alternative_date = v_slot.slot_date,
    alternative_time = v_slot.start_time,
    updated_at = now()
  where id = p_booking_id;

  -- Hold the requested replacement briefly so others cannot take it instantly
  update public.availability_slots
  set
    status = 'held',
    held_until = now() + interval '30 minutes',
    held_by = auth.uid(),
    updated_at = now()
  where id = p_new_slot_id;

  return true;
end;
$$;

grant execute on function public.get_released_availability(public.booking_type, uuid, date, date) to anon, authenticated;
grant execute on function public.hold_availability_slot(uuid, integer) to anon, authenticated;
grant execute on function public.release_slot_hold(uuid) to anon, authenticated;
grant execute on function public.submit_slot_booking_request(uuid, text, text, text, uuid, public.booking_type, text, text, integer, text, text) to anon, authenticated;
grant execute on function public.release_availability_slots(date[], time[], public.slot_appointment_type, integer, integer, uuid[], text) to authenticated;
grant execute on function public.confirm_slot_booking(uuid, text) to authenticated;
grant execute on function public.decline_slot_booking(uuid, boolean, text) to authenticated;
grant execute on function public.complete_slot_booking(uuid) to authenticated;
grant execute on function public.request_slot_reschedule(uuid, uuid) to authenticated;
grant execute on function public.expire_stale_holds() to authenticated;

-- RLS
alter table public.availability_slots enable row level security;
alter table public.availability_slot_services enable row level security;

drop policy if exists availability_slots_staff_all on public.availability_slots;
create policy availability_slots_staff_all on public.availability_slots
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Public may read only bookable released slots (no admin notes exposed via select *)
-- Clients use get_released_availability RPC for booking; staff use direct table.
drop policy if exists availability_slots_public_read_available on public.availability_slots;
create policy availability_slots_public_read_available on public.availability_slots
  for select to anon, authenticated
  using (
    status in ('available', 'held')
    and slot_date >= current_date
  );

drop policy if exists availability_slot_services_staff_all on public.availability_slot_services;
create policy availability_slot_services_staff_all on public.availability_slot_services
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists availability_slot_services_public_read on public.availability_slot_services;
create policy availability_slot_services_public_read on public.availability_slot_services
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.availability_slots s
      where s.id = slot_id and s.status in ('available', 'held') and s.slot_date >= current_date
    )
  );

-- Extend client_bookings view with slot id
create or replace view public.client_bookings
with (security_invoker = true)
as
select
  b.id,
  b.client_id,
  b.service_id,
  b.booking_type,
  b.booking_source,
  b.requested_date,
  b.requested_time,
  b.confirmed_start,
  b.confirmed_end,
  b.alternative_date,
  b.alternative_time,
  b.suburb,
  b.number_of_people,
  b.customer_notes,
  b.client_message,
  b.status,
  b.availability_slot_id,
  b.created_at,
  b.updated_at
from public.bookings b;

grant select on public.client_bookings to authenticated;

-- Protect availability_slot_id from client tampering
create or replace function public.protect_booking_client_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_staff() then
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status not in ('reschedule_requested', 'cancelled') then
    raise exception 'Clients cannot set booking status to %', new.status;
  end if;

  new.admin_notes := old.admin_notes;
  new.customer_address := old.customer_address;
  new.confirmed_start := old.confirmed_start;
  new.confirmed_end := old.confirmed_end;
  new.client_id := old.client_id;
  new.created_by := old.created_by;
  new.booking_source := old.booking_source;
  new.travel_buffer_minutes := old.travel_buffer_minutes;
  new.availability_slot_id := old.availability_slot_id;

  if new.status = 'reschedule_requested' then
    null;
  elsif new.status = 'cancelled' then
    -- Re-release linked slot when client cancels a request
    if old.availability_slot_id is not null and old.status in ('requested', 'awaiting_confirmation') then
      update public.availability_slots
      set status = 'available', booking_id = null, held_until = null, held_by = null, updated_at = now()
      where id = old.availability_slot_id and status = 'requested';
    end if;
  else
    new.requested_date := old.requested_date;
    new.requested_time := old.requested_time;
  end if;

  return new;
end;
$$;
