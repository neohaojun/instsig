insert into public.batches (name, description)
values
  ('Alpha', 'Example batch'),
  ('Bravo', 'Example batch')
on conflict do nothing;

-- Replace this email with the user you want to promote to admin.
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
