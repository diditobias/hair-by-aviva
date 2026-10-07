-- Anonymous visitors book from the public site. Policies written as
-- "(active = true) OR is_staff()" fail for them, because anon cannot execute
-- is_staff(). Staff already have their own policies, so the public policies
-- only need the public condition.

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon, authenticated
  using (active = true);

drop policy if exists gallery_public_read on public.gallery_images;
create policy gallery_public_read on public.gallery_images
  for select to anon, authenticated
  using (visible = true);

drop policy if exists testimonials_public_read on public.testimonials;
create policy testimonials_public_read on public.testimonials
  for select to anon, authenticated
  using (active = true);

drop policy if exists availability_slots_public_read_available on public.availability_slots;
create policy availability_slots_public_read_available on public.availability_slots
  for select to anon, authenticated
  using (
    status in ('available', 'held')
    and slot_date >= current_date
  );

drop policy if exists availability_slot_services_public_read on public.availability_slot_services;
create policy availability_slot_services_public_read on public.availability_slot_services
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.availability_slots s
      where s.id = slot_id
        and s.status in ('available', 'held')
        and s.slot_date >= current_date
    )
  );
