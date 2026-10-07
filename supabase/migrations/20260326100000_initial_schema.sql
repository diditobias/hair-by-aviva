-- Hair by Aviva — initial schema, roles, and RLS
-- Project: xmofejcerbjjjlzarebe

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.user_role as enum ('owner', 'admin', 'client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum (
    'requested',
    'awaiting_confirmation',
    'confirmed',
    'reschedule_requested',
    'completed',
    'cancelled',
    'declined'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_type as enum ('home_visit', 'wig');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_source as enum (
    'website', 'admin', 'whatsapp', 'instagram', 'phone', 'referral', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.enquiry_status as enum ('new', 'in_progress', 'replied', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_category as enum (
    'haircuts', 'styling', 'occasion', 'wigs', 'other'
  );
exception when duplicate_object then null;
end $$;

-- Profiles (auth.users 1:1)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  role public.user_role not null default 'client',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CRM clients (may exist without auth accounts)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  suburb text,
  preferred_contact text check (preferred_contact is null or preferred_contact in ('phone', 'whatsapp', 'email')),
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.service_category not null default 'other',
  description text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price_from numeric(10, 2),
  display_price boolean not null default true,
  booking_type public.booking_type,
  home_call_eligible boolean not null default true,
  wig_appointment boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  service_id uuid references public.services (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  booking_source public.booking_source not null default 'website',
  booking_type public.booking_type not null,
  requested_date date,
  requested_time time,
  confirmed_start timestamptz,
  confirmed_end timestamptz,
  alternative_date date,
  alternative_time time,
  suburb text,
  customer_address text,
  number_of_people integer not null default 1 check (number_of_people >= 1),
  customer_notes text,
  admin_notes text,
  client_message text,
  travel_buffer_minutes integer not null default 30 check (travel_buffer_minutes >= 0),
  status public.booking_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  subject text,
  category text,
  message text not null,
  preferred_contact text,
  status public.enquiry_status not null default 'new',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Hair by Aviva',
  tagline text default 'Beautiful hair, at home or in studio',
  phone text,
  whatsapp text,
  email text,
  instagram text,
  accept_bookings boolean not null default true,
  home_visits_enabled boolean not null default true,
  wig_appointments_enabled boolean not null default true,
  max_advance_days integer not null default 60,
  min_notice_hours integer not null default 24,
  default_duration_minutes integer not null default 60,
  default_travel_buffer_minutes integer not null default 30,
  service_areas text[] not null default '{}',
  travel_fee_message text,
  show_prices boolean not null default true,
  show_testimonials boolean not null default true,
  show_instagram boolean not null default true,
  announcement_banner text,
  notification_email text,
  working_hours jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  category text not null default 'Haircuts',
  image_url text not null,
  before_url text,
  after_url text,
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  quote text not null,
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Blocked',
  block_type text not null default 'blocked' check (block_type in ('blocked', 'personal', 'holiday', 'unavailable')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_requested_date_idx on public.bookings (requested_date);
create index if not exists bookings_confirmed_start_idx on public.bookings (confirmed_start);
create index if not exists bookings_client_id_idx on public.bookings (client_id);
create index if not exists clients_auth_user_id_idx on public.clients (auth_user_id);
create index if not exists clients_name_idx on public.clients (full_name);
create index if not exists enquiries_status_idx on public.enquiries (status);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists enquiries_updated_at on public.enquiries;
create trigger enquiries_updated_at before update on public.enquiries
for each row execute function public.set_updated_at();

drop trigger if exists business_settings_updated_at on public.business_settings;
create trigger business_settings_updated_at before update on public.business_settings
for each row execute function public.set_updated_at();

-- Auth helpers
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent privilege escalation: only staff can change roles; clients cannot self-promote
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL editor / service role have no auth.uid() — allow bootstrap + admin ops
  if auth.uid() is null then
    return new;
  end if;

  -- OLD is only valid on UPDATE — referencing it on INSERT fails in Postgres
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_staff() then
    raise exception 'Only staff can change roles';
  end if;
  if tg_op = 'INSERT' and new.role in ('owner', 'admin') and not public.is_staff() then
    new.role := 'client';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- Public booking RPC (no account required)
create or replace function public.submit_booking_request(
  p_full_name text,
  p_email text,
  p_phone text,
  p_service_id uuid,
  p_booking_type public.booking_type,
  p_requested_date date,
  p_requested_time time,
  p_suburb text default null,
  p_customer_address text default null,
  p_number_of_people integer default 1,
  p_customer_notes text default null,
  p_preferred_contact text default null,
  p_alternative_date date default null,
  p_alternative_time time default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_booking_id uuid;
  v_settings public.business_settings%rowtype;
  v_buffer integer;
begin
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

  v_buffer := coalesce(v_settings.default_travel_buffer_minutes, 30);

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

  -- If logged-in client already has a CRM row, prefer linking instead of duplicate when email matches
  if auth.uid() is not null then
    update public.clients
    set auth_user_id = auth.uid()
    where id = v_client_id;
  end if;

  insert into public.bookings (
    client_id, service_id, created_by, booking_source, booking_type,
    requested_date, requested_time, alternative_date, alternative_time,
    suburb, customer_address, number_of_people, customer_notes,
    travel_buffer_minutes, status
  ) values (
    v_client_id, p_service_id, auth.uid(), 'website', p_booking_type,
    p_requested_date, p_requested_time, p_alternative_date, p_alternative_time,
    nullif(trim(coalesce(p_suburb, '')), ''),
    nullif(trim(coalesce(p_customer_address, '')), ''),
    greatest(coalesce(p_number_of_people, 1), 1),
    p_customer_notes,
    v_buffer,
    'requested'
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

create or replace function public.submit_enquiry(
  p_full_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_message text,
  p_category text default null,
  p_preferred_contact text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'Name is required';
  end if;
  if p_message is null or length(trim(p_message)) < 3 then
    raise exception 'Message is required';
  end if;

  insert into public.enquiries (
    full_name, email, phone, subject, category, message, preferred_contact, status
  ) values (
    trim(p_full_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_subject, '')), ''),
    p_category,
    trim(p_message),
    p_preferred_contact,
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_booking_request(text, text, text, uuid, public.booking_type, date, time, text, text, integer, text, text, date, time) to anon, authenticated;
grant execute on function public.submit_enquiry(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.current_role() to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.enquiries enable row level security;
alter table public.business_settings enable row level security;
alter table public.gallery_images enable row level security;
alter table public.testimonials enable row level security;
alter table public.availability_blocks enable row level security;

-- Profiles
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());

-- Clients
drop policy if exists clients_staff_all on public.clients;
create policy clients_staff_all on public.clients
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists clients_update_own on public.clients;
create policy clients_update_own on public.clients
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Services
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon, authenticated
  using (active = true);

drop policy if exists services_staff_all on public.services;
create policy services_staff_all on public.services
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Bookings: staff full access; clients see own rows but NEVER admin_notes / customer_address via view preference
-- Direct table: clients can select own bookings; column-level not available — app must not select admin_notes for clients.
-- Extra guard: clients cannot update admin_notes / status to confirmed etc.
drop policy if exists bookings_staff_all on public.bookings;
create policy bookings_staff_all on public.bookings
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own on public.bookings
  for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = bookings.client_id and c.auth_user_id = auth.uid()
    )
  );

drop policy if exists bookings_update_own_limited on public.bookings;
create policy bookings_update_own_limited on public.bookings
  for update to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = bookings.client_id and c.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = bookings.client_id and c.auth_user_id = auth.uid()
    )
    and status in ('requested', 'awaiting_confirmation', 'confirmed', 'reschedule_requested', 'cancelled')
  );

-- Enquiries
drop policy if exists enquiries_staff_all on public.enquiries;
create policy enquiries_staff_all on public.enquiries
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Business settings: public can read; staff can update
drop policy if exists business_settings_public_read on public.business_settings;
create policy business_settings_public_read on public.business_settings
  for select to anon, authenticated
  using (true);

drop policy if exists business_settings_staff_update on public.business_settings;
create policy business_settings_staff_update on public.business_settings
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists business_settings_staff_insert on public.business_settings;
create policy business_settings_staff_insert on public.business_settings
  for insert to authenticated
  with check (public.is_staff());

-- Gallery / testimonials public read of visible/active
drop policy if exists gallery_public_read on public.gallery_images;
create policy gallery_public_read on public.gallery_images
  for select to anon, authenticated
  using (visible = true);

drop policy if exists gallery_staff_all on public.gallery_images;
create policy gallery_staff_all on public.gallery_images
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists testimonials_public_read on public.testimonials;
create policy testimonials_public_read on public.testimonials
  for select to anon, authenticated
  using (active = true);

drop policy if exists testimonials_staff_all on public.testimonials;
create policy testimonials_staff_all on public.testimonials
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists availability_staff_all on public.availability_blocks;
create policy availability_staff_all on public.availability_blocks
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Seed singleton settings + sample services
insert into public.business_settings (
  id, business_name, tagline, phone, whatsapp, email, instagram,
  service_areas, travel_fee_message, notification_email
) values (
  1,
  'Hair by Aviva',
  'Beautiful hair, at home or in studio',
  '+27725783392',
  '+27725783392',
  'avivatobias@gmail.com',
  null,
  array['Local suburbs — ask about your area'],
  'Travel fees may apply depending on location.',
  'avivatobias@gmail.com'
)
on conflict (id) do nothing;

insert into public.services (name, category, description, duration_minutes, price_from, display_price, booking_type, home_call_eligible, wig_appointment, sort_order)
select * from (values
  ('Cut & Blow-Dry', 'haircuts'::public.service_category, 'Precision cut finished with a polished blow-dry.', 75, 65.00, true, 'home_visit'::public.booking_type, true, false, 1),
  ('Blow-Dry', 'styling'::public.service_category, 'Smooth, voluminous finish for everyday or events.', 45, 45.00, true, 'home_visit'::public.booking_type, true, false, 2),
  ('Occasion Hair', 'occasion'::public.service_category, 'Elegant styling for weddings, parties and celebrations.', 90, 90.00, true, 'home_visit'::public.booking_type, true, false, 3),
  ('Wig / Sheitel Cut', 'wigs'::public.service_category, 'Expert cutting and shaping for wigs and sheitels.', 60, 70.00, true, 'wig'::public.booking_type, false, true, 4),
  ('Wig / Sheitel Style', 'wigs'::public.service_category, 'Styling and finishing for your wig or sheitel.', 60, 60.00, true, 'wig'::public.booking_type, false, true, 5)
) as v(name, category, description, duration_minutes, price_from, display_price, booking_type, home_call_eligible, wig_appointment, sort_order)
where not exists (select 1 from public.services limit 1);
