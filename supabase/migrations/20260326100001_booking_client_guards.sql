-- Restrict what clients can change on their own bookings
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

  -- Clients may only request reschedule or cancellation; cannot set confirmed/completed/etc.
  if new.status is distinct from old.status
     and new.status not in ('reschedule_requested', 'cancelled') then
    raise exception 'Clients cannot set booking status to %', new.status;
  end if;

  -- Lock privileged fields
  new.admin_notes := old.admin_notes;
  new.customer_address := old.customer_address;
  new.confirmed_start := old.confirmed_start;
  new.confirmed_end := old.confirmed_end;
  new.client_id := old.client_id;
  new.created_by := old.created_by;
  new.booking_source := old.booking_source;
  new.travel_buffer_minutes := old.travel_buffer_minutes;

  if new.status = 'reschedule_requested' then
    -- allow alternative date/time updates
    null;
  elsif new.status = 'cancelled' then
    null;
  else
    new.requested_date := old.requested_date;
    new.requested_time := old.requested_time;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_booking_client_update on public.bookings;
create trigger protect_booking_client_update
  before update on public.bookings
  for each row execute function public.protect_booking_client_update();

-- Client-safe view (excludes admin_notes and full address)
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
  b.created_at,
  b.updated_at
from public.bookings b;

grant select on public.client_bookings to authenticated;

-- Clients may create/link their own CRM row (no private_notes on insert)
drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own on public.clients
  for insert to authenticated
  with check (auth_user_id = auth.uid() and private_notes is null);

create or replace function public.protect_client_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_staff() then
    return new;
  end if;
  new.private_notes := old.private_notes;
  new.auth_user_id := old.auth_user_id;
  return new;
end;
$$;

drop trigger if exists protect_client_self_update on public.clients;
create trigger protect_client_self_update
  before update on public.clients
  for each row execute function public.protect_client_self_update();
