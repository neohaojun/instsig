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
2. admins can toggle the dashboard between `User` and `Admin` modes inside the `/` client shell
3. the user dashboard shows separate compact history cards for report sick and external appointment requests, each with up to 2 recent requests and a `View all` link at the bottom
4. the admin dashboard keeps separate compact pending-request previews for report sick and external appointment requests, each with up to 2 subcards and a `View all` link at the bottom
5. the admin dashboard includes a `Strength` summary card with a `See more` path into the strength detail view
6. the `/history` page remains focused on completed or older records
7. the admin request queue lives on `/admin/requests`

UI expectations:

- keep dashboard request cards task-oriented and compact
- use colored status badges that reflect the request state
- build request links with the hyphenated route slugs (`/requests/report-sick` and `/requests/external-appointment`), not the raw underscored `RequestKind` values
- the dashboard request history card may surface in-progress requests so users can resume them
- dashboard, history, and admin queue cards should use shared request-card formatting helpers where practical so date, requester, and 5W1H lines stay consistent
- user dashboard history cards should be split into `Report Sick History` and `Ext Appt History`
- the admin queue page should split requests into separate `Report Sick` and `Ext Appt` sections, mirroring the dashboard and history structure
- each admin queue subcard should match the dashboard pending-request subcard format: requester name as the title, profile/batch details as the muted description line, original request date/time as the meta line, and status on the right
- admin queue rows should link directly to the matching admin request detail page
- do not show "start new request" controls inside the existing report sick dashboard list
- do not duplicate the live report sick request list in history
- on the dashboard pending-requests preview, fold the request type into the row description instead of showing a separate type badge
- pending admin items may show a small action marker for `Review needed` or `Ready to endorse`; keep it subtle and consistent across dashboard and queue views

## Admin Dashboard, Users, and Batches

Expected flow:

1. `/admin` redirects back to `/`; the root shell is the canonical admin gateway
2. admin-only views available from the shell or nav include `/admin/requests`, `/admin/users`, `/admin/batches`, and the strength detail view
3. `/admin/users` presents a mobile-friendly profile directory and editing surface
4. `/admin/batches` presents read-only imported batch records for lookup

UI expectations:

- keep admin dashboard content compact and task-oriented inside the root shell
- do not recreate a separate `/admin` landing dashboard; it should continue to redirect to `/`
- `/admin/users` should use the same gray glass-card language as the rest of the app
- prefer stacked cards or responsive grids over wide tables on mobile
- make sure `/admin/users` shows the available profile data that matters for admin lookup, including rank, email, role, batch, NR, SSCC batch, common term platoon, and specialisation phase platoon
- prefer the shared rank-prefixed display format when showing linked person names
- keep any missing profile values readable with a safe fallback such as `Not set`
- keep `/admin/batches` visually aligned with the current admin surfaces; use safe fallbacks for missing Firestore IDs and dates

## Strength Dashboard

Expected flow:

1. admin dashboard shows a compact strength summary
2. `See more` opens the strength detail view in the root client shell, while `/dashboard/strength` remains a server route fallback
3. strength data is calculated from profiles, requests, and report-sick follow-up updates

UI expectations:

- keep the summary focused on `Total`, `Current`, `Attend C`, `Attend B`, and `Reporting Sick`
- the detail view should group personnel into `Attend C`, `Attend B`, `Reporting Sick`, `External Appt`, `Guard Duty`, `On Medication`, and `Others`
- use rank-prefixed names through `formatProfileName`
- keep category rows compact with a name, description, and uppercase meta line
- do not turn the strength dashboard into a broad analytics page unless the underlying data model supports it

Data expectations:

- `lib/strength-summary.ts` is the source for strength calculations
- `lib/active-report-sick-statuses.ts` determines active report-sick statuses from follow-up status entries
- strength totals should exclude admin profiles from personnel counts
- `Current` subtracts personnel who are unavailable due to active Attend C, same-day report sick, or same-day external appointment
- `Guard Duty` and `Others` are currently placeholders unless supporting data is added
- `On Medication` comes from doctor follow-up medication values, excluding empty or `Nil` values

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
- imported `batches` records are used to enrich requester descriptions and admin/user lookup views
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
- `app/admin/batches/page.tsx`
- `app/dashboard/strength/page.tsx`
- `app/requests/report-sick/page.tsx`
- `app/requests/external-appointment/page.tsx`
- `app/admin/requests/[id]/page.tsx`
- `components/instsig/instsig-app.tsx`
- `components/dashboard/strength-card.tsx`
- `components/dashboard/strength-detail.tsx`
- `components/request/request-form.tsx`
- `components/request/admin-report-sick-followup-card.tsx`
- `components/request/report-sick-followup-form.tsx`
- `components/request/report-sick-followup-display.tsx`
- `components/request/request-summary.tsx`
- `components/request/admin-review-panel.tsx`
- `components/layout/topbar.tsx`
- `components/layout/profile-menu.tsx`
- `lib/active-report-sick-statuses.ts`
- `lib/display-date.ts`
- `lib/profile-display.ts`
- `lib/request-card-display.ts`
- `lib/strength-summary.ts`
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
- Keep the base link `/` as the canonical app entry point, rendering the instsig app there directly like the `flykyte` app does instead of using `/` only as a redirector.
- Preserve the `/` client shell pattern for dashboard, history, admin landing, admin queue, and common request detail navigation so app buttons switch views locally instead of forcing full route transitions.
- Keep `/admin` as a redirect to `/`; do not rebuild it as a separate admin landing page while the root shell owns admin navigation.
- Preserve local shell state updates after request creation, admin review, endorsement, and follow-up submission so common interactions do not require route transitions or full refetches.
- The `/` client shell intentionally shifts backend work to the initial app load so common clicks feel instant; avoid adding per-click refetches unless data freshness requires it.
- Watch shell payload size as request volume grows, especially for admin users. If initial load becomes heavy, prefer cached lazy detail fetches, pagination, or Supabase realtime updates over reverting to full route transitions.
- Treat shell data as a snapshot. Keep mutation callbacks updating local shell state after successful writes, and use refresh/realtime/polling when cross-user freshness matters.
