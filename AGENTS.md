# Project Context

This repo is a Next.js app for `Signal Institute` that digitizes two request flows:

- `report_sick`
- `external_appointment`

The app uses:

- Next.js App Router
- Supabase Auth
- Supabase Postgres
- Tailwind CSS
- shadcn-style UI primitives

# Product Direction

Keep the app visually consistent with the current restored version.

Important style constraints:

- preserve the neutral gray / zinc palette
- keep shadcn theme tokens on the default neutral palette; avoid slate/blue HSL hues for core dark-mode surfaces
- preserve the existing glass / card / border treatment
- keep dark mode as the default theme and preserve the navbar light-mode toggle to the left of the profile menu
- avoid adding marketing fluff
- keep mobile layouts task-oriented
- avoid introducing loud colors or mismatched components

Important interaction constraints:

- menus and popovers should close on outside click / tap
- menus and popovers should close on `Escape`
- mobile behavior should feel intentional and predictable
- mobile Safari should never expose the default white canvas above or below the app shell; keep the root `html` and `body` backgrounds opaque/dark and use viewport-safe height handling when needed
- date-picker popovers should behave like overlays, not in-flow expansions
- date-picker popovers should open below their trigger field and align to the field edge
- choosing a valid date should save the value immediately and close the popover
- profile/menu labels should use the user's display name where available instead of generic placeholders
- any account-linked person label should include rank when a profile record has one, especially in profile menus, approval banners, and admin audit labels
- do not surface raw backend, auth, or database error messages directly in the UI; replace them with user-safe fallback text and keep the detailed error in console/debug logs only

# Request Lifecycles

## Report Sick

Expected flow:

1. initial request
2. admin approval
3. user submits post-visit details
4. admin finalizes

UI expectations:

- show who approved and when
- show who finalized and when
- keep report-sick forms and associated read-only/follow-up viewers on the active theme background from top to bottom
- report-sick read-only viewers and follow-up surfaces should include a clear `Close` action for users
- dashboard preview cards should show the request status badge alongside request type, person where relevant, and original date/time
- status badge colors should use yellow for `Pending`, green for `Approved`, violet for `Submitted`, and blue for `Finalised`
- dashboard, history, and admin queue rows should keep status badges with consistent labels and colors
- form close controls should use consistent `Close` button UI/UX, successful form actions should return to the previous page after saving, and each form/detail page should show only one close button
- keep the report sick page split into two halves once a request exists:
  - initial request
  - post-visit details
- post-visit details should only become editable after admin approval
- instruction-heavy cards were intentionally removed from this page
- existing report sick requests should be surfaced as clickable subcards on the dashboard
- each dashboard subcard should show the request status and the original sick-report date/time, not generic "updated" text
- dashboard report sick subcards should link directly to the matching report sick detail page for continuing or viewing the request
- avoid repeating approval banners or extra action buttons inside the dashboard subcard list

Current initial request fields:

- `dateReportingSick`
- `timeReportingSick`
- `where`
- `symptoms`
- `contractionSource`

Date Reporting Sick UI expectations:

- use a shadcn-style calendar picker rather than a plain date input
- the calendar should float below the field as an overlay
- highlight today
- grey out and disable future dates
- keep `Time Reporting Sick` left aligned in both editable and read-only views

Current post-visit fields:

- `diagnosis`
- `noStatusReceived`
- `statusesReceived` as a list of status entries, each with:
  - `days`
  - `type`
  - `startDate`
  - `endDate`
- `swab` uses a radio group
- `saArt`
- `haArt`
- `pcr`
- `nature`
- `safety`
- `category`
- `medication`
- `remarks`

## External Appointment

Expected flow:

1. request
2. admin approval or rejection

UI expectations:

- use the same form-like card treatment as report-sick request forms for editable, read-only, and admin review surfaces
- show who approved and when
- show who rejected and when
- once reviewed, the request should be read-only to the user

## Dashboard and History

Expected flow:

1. new request entry points stay on the dashboard
2. the dashboard shows a compact `Request History` card with up to 2 recent requests and a `View all` link at the bottom
3. the dashboard keeps a compact pending-requests preview for admins with up to 2 subcards and a `View all` link at the bottom
4. the `/history` page remains focused on completed or older records
5. the admin request queue lives on `/admin/requests`

UI expectations:

- keep dashboard request cards task-oriented and compact
- use colored status badges that reflect the request state
- build request links with the hyphenated route slugs (`/requests/report-sick` and `/requests/external-appointment`), not the raw underscored `RequestKind` values
- the dashboard request history card may surface in-progress requests so users can resume them
- the admin queue page should split pending requests into separate `Report Sick` and `External Appointment` cards, mirroring the history page structure
- each admin queue subcard should match the dashboard pending-request subcard format: requester name as the title, request type as the muted description line, original request date/time as the uppercase meta line, and status on the right
- admin queue rows should link directly to the matching admin request detail page
- do not show "start new request" controls inside the existing report sick dashboard list
- do not duplicate the live report sick request list in history
- on the dashboard pending-requests preview, fold the request type into the row description instead of showing a separate type badge

## Admin Landing and Users

Expected flow:

1. `/admin` acts as a minimal gateway page
2. `/admin` only links to `/admin/requests` and `/admin/users`
3. `/admin/users` presents a mobile-friendly profile directory

UI expectations:

- keep the `/admin` landing page compact and task-oriented
- do not add extra admin modules, counters, or dashboard-style summaries on `/admin`
- `/admin/users` should use the same gray glass-card language as the rest of the app
- prefer stacked cards or responsive grids over wide tables on mobile
- make sure `/admin/users` shows the available profile data that matters for admin lookup, including rank, email, role, batch, NR, SSCC batch, common term platoon, and specialisation phase platoon
- prefer the shared rank-prefixed display format when showing linked person names
- keep any missing profile values readable with a safe fallback such as `Not set`

## Admin Request Detail

UI expectations:

- the admin request detail page should mirror the user report-sick follow-up form layout as closely as practical
- keep the request summary in a form-like read-only card treatment rather than a generic admin summary panel
- the requester card should be compact, titled `Submitted by`, and use the description line for name, rank, batch numbers, platoon names, and other key identifiers instead of nested subcards
- the requester card should sit at the top of the admin request detail page before the request/follow-up card layout
- for report sick, the post-visit details card on the admin detail page should look like the actual user follow-up form with disabled controls, not like a generic summary card
- do not add an extra submission-details subcard inside the post-visit details card
- finalized-by metadata belongs at the bottom of the post-visit details card when post-visit details exist
- do not add a separate submitted-by subcard inside the post-visit details card
- admin actions should follow the request lifecycle: approve or reject before review, show a waiting state after approval, and allow finalization only after report-sick follow-up details exist
- `Cancel` should return the admin to the previous page without mutating request data
- do not show lifecycle history blocks or separate admin review forms on this page

# Data Model Notes

Relevant types live in `lib/types.ts`.

Important shapes:

- `ReportSickPayload` stores only the initial report-sick submission
- `ReportSickFollowupPayload` stores post-visit details, including structured status entries and the `noStatusReceived` flag
- `request_updates` with kind `doctor_followup` stores the report-sick follow-up stage
- requester follow-up saves should use the existing `request_updates` row and not depend on a new RPC unless the matching Supabase migration has definitely been applied
- admin finalization should key off the presence of the follow-up record and request lifecycle fields, not a requester-side status flip from `approved` to `submitted`

Approval / review metadata is stored on `requests`:

- `approved_by`
- `approved_at`
- `rejected_by`
- `rejected_at`
- `finalized_by`
- `finalized_at`
- `followup_submitted_at`

Admin action writes should use admin profile IDs for `*_by` fields, not emails.
When showing a person name linked to a profile, prefer the shared rank-prefixed display format instead of raw `full_name` or email-only fallbacks.

# Important Files

- `app/admin/page.tsx`
- `app/admin/users/page.tsx`
- `app/requests/report-sick/page.tsx`
- `app/requests/external-appointment/page.tsx`
- `app/admin/requests/[id]/page.tsx`
- `components/request/request-form.tsx`
- `components/request/admin-report-sick-followup-card.tsx`
- `components/request/report-sick-followup-form.tsx`
- `components/request/request-summary.tsx`
- `components/request/admin-review-panel.tsx`
- `components/layout/topbar.tsx`
- `components/layout/profile-menu.tsx`
- `lib/profile-display.ts`
- `lib/types.ts`
- `supabase/schema.sql`

# Verification

Before handing off major UI or flow changes:

- run `npm run build`
- watch for formatting regressions
- prefer structured summary cards over raw JSON dumps
- do not reintroduce broken `details`-based menu behavior

# Supabase Schema

If the app reports a missing table or schema cache issue for a known object such as `public.request_updates`:

- treat `supabase/schema.sql` as the source of truth for the required object definition
- apply the matching SQL to the actual Supabase project, then refresh the schema cache in Supabase if needed
- avoid rendering the raw SQL/Supabase error text in page banners or inline cards
- for follow-up submission failures, prefer the existing table write path over adding a new RPC call that can get stuck behind schema cache drift
- assume some Supabase projects may already have older versions of `public.requests`, `public.request_updates`, or related policies; prefer additive `alter table ... add column if not exists ...`, `create index if not exists`, and `drop policy if exists` / recreate patterns so rerunning `supabase/schema.sql` upgrades an existing project cleanly
- if a rerun fails on a missing column such as `followup_submitted_at`, treat that as schema drift from an older table definition and patch `supabase/schema.sql` to be rerunnable rather than relying on a fresh-project-only `create table if not exists` path

# Environment Notes

- Supabase browser/client setup should support `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` so older Vercel environments do not crash on startup.
- Keep `typedRoutes: true` at the top level of `next.config.mjs`; do not move it under `experimental`.
