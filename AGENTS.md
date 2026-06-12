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
- preserve the existing glass / card / border treatment
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

- show who approved and when
- once reviewed, the request should be read-only to the user

## Dashboard and History

Expected flow:

1. new request entry points stay on the dashboard
2. the dashboard keeps a single compact pending-requests card for admins with a `View all` link
3. request history remains focused on completed or older records
4. the admin request queue lives on `/admin/requests`

UI expectations:

- keep dashboard request cards task-oriented and compact
- use colored status badges that reflect the request state
- the admin queue page should split pending requests into separate `Report Sick` and `External Appointment` cards, mirroring the history page structure
- each admin queue card should list requester name, request type badge, original submitted date/time, and status
- admin queue rows should link directly to the matching admin request detail page
- do not show "start new request" controls inside the existing report sick dashboard list
- do not duplicate the live report sick request list in history

## Admin Request Detail

UI expectations:

- the admin request detail page should mirror the user report-sick follow-up form layout as closely as practical
- keep the request summary in a form-like read-only card treatment rather than a generic admin summary panel
- admin actions should be limited to approve or reject on the detail page
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

- `app/requests/report-sick/page.tsx`
- `app/requests/external-appointment/page.tsx`
- `app/admin/requests/[id]/page.tsx`
- `components/request/request-form.tsx`
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
