# Backoffice: Remaining Scope and API Plan

> Pages, components and the frontdesk "Civic" theme are in `_notes/backoffice-ui-plan.md`.

## Context
The backoffice (`latest/`, Next 16.4 with `cacheComponents`, Mongoose 9, NextAuth v4, shadcn base-sera on Base UI) already has:
- sign-in, first-run setup and logout
- the sidebar/header shell
- the live dashboard (`/api/v1/metrics`)
- the team's department CRUD

Services, Employees, Leaves, the officer queue console and the notifier are still missing. This plan covers every remaining backoffice scope and its API, using the choices made in the Q&A on 2026-10-10. Only `latest/` is edited; what frontdesk must copy is listed at the end.

**Decisions**
- **Admin scope:** one ADMIN manages **all departments**; OFFICERs only their assigned services.
- **Leaves page:** replaces the empty Calendar page.
- **Queue console (OFFICER only):** core actions, 10 s auto-refresh, token search.
- **Extras:** staff password reset (admin resets; staff change their own), and **counter numbers**.
- **Services:** CRUD + active toggle (no hard delete), assign officers from the service form, a today's-capacity column, and a per-service alert lead time.
- **Employees:** the admin types the initial password.
- **Notifier: log only.** Each alert goes to the console and the token's `notifications` log; nothing is sent through Twilio/Resend.
- **Shared code:** `lib/queue-core.ts` here is the master; frontdesk copies it byte-identical, like the models.
- Already agreed: dashboard impact metrics, and the out-of-scope cleanup.

## API conventions (every new or changed route)
- Paths are `/api/v1/<plural noun>`; partial updates use `PATCH`. Errors return `{ error }` with 400/401/403/404/409.
- **`requireStaff(role?)` in `lib/auth.ts`:**
  - It reads the session, then **re-reads the Employee from the database** (role, isActive, serviceIds, counterNumber).
  - It returns either `{ employee }` or a 401/403 response.
  - The JWT lasts 12 h and goes stale, and the proxy doesn't guard `/api`, so every handler calls this.
- **Validation:** every body is checked by a zod schema in `lib/validators.ts`. The same schema drives the form (react-hook-form + `zodResolver`).
- **Cache Components rules:**
  - Don't export `dynamic`/`revalidate`.
  - Read the session or request before calling `new Date()` or the database.
  - Start every `catch` with `unstable_rethrow(error)`; this also applies to the existing metrics, departments and signup routes.
  - Pages are client components that fetch these APIs.
- **Dates:**
  - `YYYY-MM-DD` and `HH:mm` strings are checked by regex.
  - Time zones are validated with a `try { new Intl.DateTimeFormat(..., { timeZone }) }`. `Intl.supportedValuesOf` lacks `Asia/Kolkata` and `UTC`, so it can't be used.
  - Never use `new Date("YYYY-MM-DD")`, `getDay()` or date-fns for zoned dates.

## Scopes

### 0. Foundations
- **Model changes** (shared, additive, optional):
  - `Employee.counterNumber`: Number, min 1.
  - `CitizenToken.counterNumber`: copied when the token is called.
  - `Service.alertLeadMinutes`: default 30, range 0–240.
  - Index: partial unique `{servedById, date}` where `status: "IN_SERVICE"`. One token in service per officer per day; a duplicate gets 409.
  - Index: `{date, status}` for notifier scans.
  - After model edits, restart `next dev`: the `mongoose.models.X ||` cache keeps old schemas, and strict mode drops the new fields.
- **`lib/queue-core.ts`** (master, shared). It imports only `./models`, `./db` and mongoose types: no `next/*`, no `@/` alias. Every function takes `now`.
  - Pure helpers (Intl only):
    - `todayIn`, `minutesOfDayIn`
    - `zonedTimeToDate(ymd, hm, tz)`: DST-safe; parses `GMT` as offset 0
    - `addDays`, `weekdayOf`
    - `closedReason`, `isWorkingDay`, `isOnLeave`
    - `countActive`: counts **OFFICERs only**, because admins hold every service in the seed and would inflate capacity
    - `dayCapacity`: cutoff = min(service cutoff, department closing)
    - `bookingCap`
    - `estimateServeAt`: uses `max(1, active)`; zero staff is flagged NO_STAFF
    - `etasFor`
  - Database functions:
    - `activeEmployeeCount`
    - `capacityFor(serviceId, ymd, now)`: works before any queue doc exists
    - `peopleAhead`, `bookableDates`
    - `reserveSlot`: upsert the queue (retry once on E11000), then a guarded `$inc` with `returnDocument: "after"`
  - **"Today" fix:**
    - The stored `capacity` is always the full day.
    - The booking cap for today is `min(capacity, finished + floor(active × minutesLeft / avg))`, where `finished` = COMPLETED + NO_SHOW.
    - Past dates, or after the cutoff, get 0.
  - **ETA fix (found while testing):** wait = `floor(peopleAhead / active) × avg`, not the spec's `ceil`. Officers serve in parallel, so with 2 officers the 2nd person in line is served straight away. `npm run check:queue-core` asserts these rules.
- **`lib/recompute.ts`:** `recomputeQueues({departmentId | serviceIds, from?, to?}, now)`.
  - It touches queue docs dated **today or later** only, and sets only `activeEmployees` and `capacity` (0 on closed days).
  - It refreshes `estimatedServeAt` on live tokens, never `bookedServeAt`.
  - It returns `conflicts` (OVER_CAPACITY). Existing tokens are kept; the dashboard flags `issuedCount > capacity`.
  - If a day becomes a holiday after bookings, capacity drops to 0 but tokens stay; the UI shows a warning toast.

| Trigger | Recompute scope |
|---|---|
| Department change (hours, week-offs, holidays, timezone, isActive, deactivate) | All services in that department |
| Service change (avg, cutoff, daily limit, isActive, officers) | That service |
| Employee create/edit (serviceIds, isActive, role) | Old ∪ new serviceIds |
| Leave add/remove | That employee's services, from..to |

### 1. Departments (finish the team's build)
- `GET /departments`: drop the unused `search` param.
- `POST /departments`, and `PATCH /departments/[id]` (was PUT; its 2 callers updated):
  - validated by the zod `departmentSchema` (time zone, `start < end`, holiday dates, week-off days 0–6)
  - the code uniqueness check uses an exact match on the upper-cased code, not a `RegExp` built from user input
  - the response includes recompute `conflicts`
- `DELETE /departments/[id]` deactivates only; hard delete is removed. Delete the `/api/v1/department` alias.
- `department-dialog.tsx` + `department-form.tsx` move to react-hook-form + zod. `WeekOffPicker`, `TimezoneSelect` and `HolidayManager` stay as they are, plugged in through `Controller`.
- Fix the 5 `asChild` errors (Base UI: `render={<Link…/>}` + `nativeButton={false}`) so `next build` passes.

### 2. Services
| Endpoint | Role | Does |
|---|---|---|
| `GET /services?departmentId=&includeInactive=` | ADMIN | List with department, officers, today's capacity (closed reason / issued / capacity / NO_STAFF) |
| `POST /services` | ADMIN | Create; `officerIds[]` updates `Employee.serviceIds` |
| `GET /services/[id]` | ADMIN | One service + officers |
| `PATCH /services/[id]` | ADMIN | Fields, `isActive`, `officerIds`, `alertLeadMinutes`; cutoff must be ≤ department closing; then recompute |

Page `app/(admin)/services/page.tsx`: table, department filter, create/edit dialog with an officer multi-select, active switch.

### 3. Employees and passwords
| Endpoint | Role | Does |
|---|---|---|
| `GET /employees?departmentId=&role=` | ADMIN | List (no hash) with services, counter, leave count. **Replaces the unprotected `GET /employee`** |
| `POST /employees` | ADMIN | Create with name, email, admin-typed password, role, department, services, counter, active |
| `PATCH /employees/[id]` | ADMIN | Edit role, services, counter, active, then recompute. An admin can't demote or deactivate themselves; the last active admin is kept |
| `POST /employees/[id]/password` | ADMIN | Reset a password (existing sessions run out within 12 h) |
| `POST /me/password` | any staff | Change own password (current + new) |

Page `app/(admin)/employees/page.tsx`: table + create/edit dialog + reset-password dialog. "Change password" is a dialog in the sidebar user menu (`components/nav-user.tsx`); no extra page.

### 4. Leaves (replaces Calendar)
| Endpoint | Role | Does |
|---|---|---|
| `GET /leaves?departmentId=&from=` | ADMIN | Upcoming leave across employees |
| `POST /employees/[id]/leaves` | ADMIN | Add `{from, to, reason}` with `from ≤ to` and no overlap; recompute |
| `DELETE /employees/[id]/leaves?from=YYYY-MM-DD` | ADMIN | Remove one leave (identified by start date); recompute |

Page `app/(admin)/leaves/page.tsx`: list + add dialog (date range). Delete `app/(admin)/calendar/`. In `NAV` and `proxy.ts`, `/calendar` becomes `/leaves`.

### 5. Queue console (OFFICER)
| Endpoint | Does |
|---|---|
| `GET /queues?q=` | Today's queue per assigned service, with tokens by status (name + last 4 phone digits), now serving, my in-service token. `q` = token number or phone (escaped suffix match) |
| `PATCH /queues/[id]` | `{action: pause \| open \| close}` |
| `POST /queues/[id]/call-next` | Queue must be OPEN. `findOneAndUpdate({queueId, status: "ARRIVED"}, sort tokenNumber 1)` → IN_SERVICE, then `$max nowServing` |
| `PATCH /tokens/[id]` | `{action: arrive \| complete \| no_show \| cancel}` with guarded updates (below) |

| Transition | Guard | Sets | Queue counters |
|---|---|---|---|
| WAITING → ARRIVED | status WAITING | arrivedAt | none |
| ARRIVED → IN_SERVICE | via call-next | servedById, startedAt, counterNumber | `$max nowServing` |
| IN_SERVICE → COMPLETED | status IN_SERVICE, servedById = me | completedAt | `$inc completedCount` |
| WAITING/ARRIVED → NO_SHOW | status guard | none | none (counts as finished) |
| WAITING → CANCELLED | status WAITING | none | `issuedCount −1` |
| Queue OPEN ↔ PAUSED, → CLOSED, CLOSED → OPEN | date = today | status | PAUSED: no calls, no ARRIVE_SOON; CLOSED: also no bookings |

Every action also checks that the service is the officer's and the date is today. No transactions are needed: each write is a single-document atomic update, and the counter changes use `$inc`/`$max`.

Page `app/(officer)/queue/page.tsx`:
- one tab per service
- WAITING / ARRIVED / IN_SERVICE / done columns with action buttons
- a search box
- 10 s `no-store` polling in `useEffect`, plus a refetch after each action

### 6. Notifier (log only)
- **Start:** `instrumentation.ts` → `register()`: if `NEXT_RUNTIME === "nodejs"`, it dynamically imports `lib/notifier.ts` and calls `startNotifier()`. It only schedules the work and never awaits the database, and Next skips it during the build.
- **Timer:** `startNotifier` **replaces** any timer stored on `globalThis` (so dev never runs stale code), then runs every 60 s. A `running` flag on `globalThis` prevents overlapping passes.
- **One `runNotifier(now)` pass:**
  - **BOOKED:** live tokens dated from yesterday on with no BOOKED entry.
  - **CANCELLED:** the same check for cancelled tokens.
  - **Per department, each in its own try/catch:**
    - Refresh ETAs that changed by at least 1 minute on today's OPEN/PAUSED queues.
    - Send ARRIVE_SOON on OPEN queues on working days, to WAITING tokens with no `notifiedAt`, when ETA − `alertLeadMinutes` ≤ now.
- **Idempotent claim:**
  - A guarded `updateOne` (event not logged yet, and `notifiedAt` unset for ARRIVE_SOON) pushes one entry per channel.
  - `console.info` runs only when `modifiedCount === 1`.
  - Entries are logged as `SENT`; EMAIL with no address logs `FAILED` with the error `NO_EMAIL`.

### 7. Dashboard impact metrics
- `GET /metrics` gains an `impact` block, built from tokens with `startedAt`. Opening time is `openAt = zonedTimeToDate(date, workingHours.start, tz)`.
  - **Citizen-minutes saved** = Σ max(0, arrivedAt − max(openAt, createdAt)), plus the average in-office wait (startedAt − arrivedAt).
  - **ETA accuracy** = |startedAt − bookedServeAt|: mean, median, share within ±15 min, and bias.
- Two more cards on the dashboard; over-capacity and NO_STAFF queues get a warning badge in the services table.

## Frontdesk handoff (this session doesn't edit frontdesk)
- **Copy unchanged into `front/src/lib/`:** `latest/lib/models/*` (`counterNumber` ×2, `alertLeadMinutes`, 2 new indexes) and `latest/lib/queue-core.ts`.
- **Booking:**
  - Check for an existing live token.
  - Call `reserveSlot`.
  - Set both `estimatedServeAt` and `bookedServeAt` from `estimateServeAt`.
  - If the insert fails with a duplicate-key error (E11000), give the slot back (`issuedCount −1`).
- **Cancelling:** guard on WAITING, then `issuedCount −1`.
- **Notifications:** write none; the backoffice notifier logs BOOKED and CANCELLED.
- **Live page:** show `counterNumber`.

## Build order
0. Save this plan as **`latest/_notes/backoffice-plan.md`** (next to `db_diagram.svg`) for the team.
1. Foundations: model fields and indexes, `requireStaff`, validators, `queue-core`, `recompute`, `unstable_rethrow` in existing routes. Then hand the shared files to frontdesk.
   - Also rename the session cookie to `bo.session-token`: set the `cookies.sessionToken.name` option, and pass the same name to `getToken({ cookieName })` in `proxy.ts`. This was requested in the frontdesk plan, so the two apps never share cookie names on localhost.
2. Cleanup + Departments finish (`asChild` fixes, PATCH, react-hook-form + zod, recompute, remove the alias, hard delete and search).
3. Services → 4. Employees + passwords → 5. Leaves → 6. Queue console → 7. Notifier → 8. Impact metrics.

## Verification
- `npx tsc --noEmit` shows 0 errors, and `npm run build` passes once the `asChild` errors are fixed. Restart `next dev` after the model changes.
- `scripts/seed-tokens.ts` (dev only) books N tokens for today through `reserveSlot`, for test citizens `+9100000000N`. This lets the console and notifier be tested before frontdesk booking exists.
- Browser run on :3004:
  1. As admin, create a service with an officer and a counter; check today's capacity.
  2. Add leave and see capacity drop; check that a holiday and an hours change recompute too.
  3. Reset an officer's password; the officer changes it from the user menu.
  4. Seed tokens. The officer marks arrived, calls next (counter shown), completes, and marks a no-show. A double-clicked call-next gives 409. Search by number and phone; pause and close.
  5. Check the dashboard and impact cards, and that the notifier log has BOOKED and ARRIVE_SOON once each, with no duplicates.
