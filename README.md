# Report / Appointment Portal

A responsive web app for:

- reporting sick
- requesting external appointments
- admin review, approval, rejection, finalization, and suggested edits
- future batch and user management

The app is built with:

- Next.js
- Supabase Auth + Postgres
- Tailwind CSS
- shadcn-style UI primitives

## What’s included

- mobile and desktop layouts
- Supabase login
- user dashboard
- sick report form
- external appointment form
- admin dashboard
- admin request review tools
- starter Supabase SQL

## Recommended app structure

The app uses a unified `requests` table with:

- `kind` for request type
- `status` for workflow state
- `payload` for request-specific fields
- `request_updates` for the sick-report doctor follow-up step

That is more flexible than storing two totally separate tables, especially if you want to add:

- batch management
- user management
- future request types

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
cp .env.example .env.local
```

3. Set up Supabase:

- create the project
- run [`supabase/schema.sql`](./supabase/schema.sql)
- update auth settings and redirect URLs
- mark the first admin profile as `admin`

4. Run the app:

```bash
npm run dev
```

## Notes

- The current UI follows shadcn-style composition and spacing.
- Admin actions are wired through Supabase RLS so you can keep the client simple.
- The SQL schema includes a trigger that creates `profiles` rows automatically when users sign up.

## Supabase keys

Use the project URL plus the new publishable key:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
