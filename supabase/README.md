# Supabase setup

## 1. Create the project

Create a Supabase project and copy the project URL and anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## 2. Enable auth

Use email/password auth. Magic link also works, but this app ships with a straightforward email/password login screen.

Add your local and production redirect URLs in Supabase Auth settings:

- `http://localhost:3000`
- your production domain

## 3. Create the database objects

Run [`supabase/schema.sql`](./schema.sql) in the Supabase SQL editor.

This creates:

- `profiles` for role-based access and trainee metadata
- `requests` as the case header for both sick and appointment workflows
- `request_updates` for the sick-report follow-up stage
- `request_events` for audit history
- `batches` for batch metadata and course timing

## 4. Seed initial admin data

Do this in two parts:

1. Create the user account.
   - In the Supabase dashboard, go to `Authentication` -> `Users` and add a new user, or sign up once through the app’s login page.
   - The trigger in [`supabase/schema.sql`](./schema.sql) will create a matching row in `public.profiles` automatically.

2. Promote that user to admin.
   - Open `SQL Editor` in the Supabase dashboard.
   - Open [`supabase/seed.sql`](./seed.sql), replace `admin@example.com` with the new user’s email, then paste and run the SQL there.
   - Or, if you prefer, run just this update in the SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

The schema also contains a trigger that auto-creates a profile row for every new auth user.

## 4a. Firestore-to-Supabase field mapping

If you are moving data from Firestore, the original document shape can be adapted like this:

### User documents

- Firestore document ID `email` -> `profiles.email`
- `name` -> `profiles.full_name`
- `rank` -> `profiles.rank`
- `role` -> `profiles.role`
- `scsBatch` -> `profiles.batch_id` via the matching row in `public.batches`
- `commonTermPlatoon` -> `profiles.common_term_platoon`
- `ssccBatch` -> `profiles.sscc_batch`
- `specialisationPhasePlatoon` -> `profiles.specialisation_phase_platoon`
- `nr` -> `profiles.nr`

### Batch documents

- Firestore document ID `scsBatch` -> `batches.firestore_id`
- `courseStart` -> `batches.course_start`
- `commonTermEnd` -> `batches.common_term_end`
- `courseEnd` -> `batches.course_end`

`profiles.role` remains the app's admin/user source of truth, and `public.is_admin()` already checks that field.

## 5. Recommended storage additions

Not required for the first version, but useful later:

- a `request-attachments` bucket for MCs, letters, and appointment proof
- a `user-avatars` bucket if you want profile photos

## 6. Recommended schema tweaks

The app uses a single `requests` table with a `kind` field and JSONB `payload`.
For report sick, the doctor-follow-up stage is stored separately in `request_updates` so the lifecycle is explicit:

- initial 5W1H submission in `requests.payload`
- admin approval in `requests.status`
- doctor-follow-up update in `request_updates`
- finalization in `requests.status`

That is the recommended structure because it:

- keeps the workflow consistent across request types
- makes admin review logic simpler
- makes it easy to add new request types later
- avoids duplicated status code paths

If you prefer your original numeric states, you can map them to the enum values like this:

- `pending` -> `1`
- `approved` -> `2`
- `submitted` -> `3`
- `finalized` -> `4`

For external appointments:

- `pending` -> `1`
- `approved` -> `2`
- `rejected` -> `3`

The web app uses string enums because they are easier to read and safer to extend.

For imported Firestore user records, keep the `profiles.role` column as the authority for admin access. The app does not need a second admin flag, and the existing trigger and `public.is_admin()` helper already use the role field consistently.

## Notes on keys

Supabase now recommends using the publishable key (`sb_publishable_...`) for browser and client-side code.
