-- Run once in the Hair by Aviva Supabase SQL editor AFTER creating Aviva's auth user
-- in Authentication → Users (email/password).
-- Replace the email below with Aviva's login email.

update public.profiles
set role = 'owner',
    first_name = coalesce(nullif(first_name, ''), 'Aviva'),
    updated_at = now()
where email = 'aviva@example.com';

-- If the profile row is missing for that user, create it:
-- insert into public.profiles (id, email, first_name, role)
-- select id, email, 'Aviva', 'owner' from auth.users where email = 'aviva@example.com'
-- on conflict (id) do update set role = 'owner';
