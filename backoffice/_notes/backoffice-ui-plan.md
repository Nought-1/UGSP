# Backoffice UI plan: frontdesk "Civic" theme

Status: planned, not built. Decisions confirmed with the product owner on 2026-10-10.
Companion to `_notes/backoffice-plan.md` (APIs and logic). This file covers pages, components and styling only.

## Context
Frontdesk's design spec (`front/docs/DESIGN-PLAN.md`, "Civic Token Slip") defines the product look:
- warm cream paper, near-black brown ink, and government red used like a rubber stamp;
- Oswald for display, Public Sans for body;
- printed-form micro labels;
- a fixed status-colour vocabulary.

The backoffice still uses shadcn's default teal on white, with dark mode. This plan reskins the backoffice in the same palette, then designs every remaining staff page from the backoffice plan in that language.

**Decisions**
- **Primary colour is ink.** Ink buttons and the active nav item. **Brand red only for actions and signals**: Call next, live indicators, alerts, stamps and focus rings. This is the same rule as frontdesk ("red never becomes decoration").
- **Light paper only.** Dark mode is removed. The one dark surface is the board-style *Now serving* panel in the queue console, which echoes the frontdesk TV board.
- **Name stays "UGSP Backoffice".** Only colours and fonts change.
- **Shapes stay base-sera:** square corners and uppercase micro labels. They already read as a printed form. Only tokens and fonts change, so no shadcn component is edited for looks.
- **Writes happen in modals**, as in frontdesk (`front/AGENT.md` §9). Create, update and delete open a dialog over the page; pages only list and show. Auth pages are the exception.
- **English only.** The spec puts multiple languages out of scope, so no `t()` and no Noto fonts here.

## 1. Theme foundation
**`app/globals.css` `:root`** (hex values identical to frontdesk's `tailwind.config.ts`):

| Token | Value | Frontdesk name |
|---|---|---|
| `--background` | `#F6F0E6` | cream |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `#1E1917` | ink |
| `--card`, `--popover` | `#FFFDF8` | paper |
| `--primary` / `--primary-foreground` | `#1E1917` / `#F6F0E6` | ink / cream |
| `--secondary`, `--muted`, `--accent` | `#EFE6D8` | cream.dark |
| `--muted-foreground` | `#5A504A` | muted |
| `--border` | `#E2D8C8` | border |
| `--input` | `#C6B9A5` | border.dark (sera inputs are underlines, so the underline needs contrast) |
| `--destructive` | `#B91C1C` | status cancelled |
| `--ring`, `--sidebar-ring` | `#C8102E` | brand (visible red focus, as in frontdesk) |
| `--sidebar` / `--sidebar-accent` / `--sidebar-border` | `#EFE6D8` / `#E2D8C8` / `#E2D8C8` | |
| `--chart-1..5` | ink, brand, `#1D4ED8`, `#15803D`, `#B45309` | |

**Extra `@theme` colours:**
- `brand` `#C8102E`, `brand-hover` `#A00D24`, `brand-light` `#FDF2F4`
- `status-done` / `-pending` / `-cancelled` / `-called`, each with text, bg and border shades (from the frontdesk config)
- `board-bg` `#141110`, `board-tile` `#1E1917`, `board-rule` `#2C2623`, `board-digit` `#F6F0E6`, `board-dim` `#847770`

**Remove dark mode:**
- Delete the `.dark` block.
- `components/providers.tsx`: `ThemeProvider forcedTheme="light"`.
- `app/layout.tsx`: `<Toaster theme="light" …>`.

**Fonts** (`app/layout.tsx`):
- Replace Roboto and Geist with `next/font` **Oswald** (600/700) → `--font-heading`, and **Public Sans** (400/600/700) → `--font-sans`.
- base-sera `CardTitle` already uses `cn-font-heading` + uppercase, so card titles turn into Oswald automatically.

**Utilities** (in `globals.css`, the same as frontdesk so both apps feel like one product):
- `.micro-label`: Public Sans 600, 11px, uppercase, tracking 0.18em, muted.
- `tabular-nums` on every number.
- Paper grain: a `body::before` SVG `feTurbulence` overlay at opacity 0.035 with `pointer-events: none`.
- `.reveal`: page-load slide + fade, staggered 60ms, at most 5 blocks.
- `.count-fade`: plays when a live number changes (remounted by `key`).
- `.stamp`: 2px border in the status colour, uppercase Oswald, slight ink speckle mask. No rotation inside tables.
- A `prefers-reduced-motion` block that turns off pulses, reveals and count-fades.

## 2. Shared components (new)
| Component | File | Anatomy and use |
|---|---|---|
| `StatusBadge` | `components/queue/status-badge.tsx` | Token and queue status in the frontdesk mapping. WAITING: ink outline. ARRIVED: called blue. IN_SERVICE: filled brand with a pulse. COMPLETED: done green. CANCELLED / NO_SHOW: cancelled red, struck through. Queue OPEN / PAUSED / CLOSED: green / amber / red pills |
| `TokenLabel` | `components/queue/token-label.tsx` | Ink block with a cream Oswald label (`DL-012`), as on frontdesk's My-tokens stubs. Sizes `sm` (tables) and `lg` (console) |
| `LiveBadge` | `components/queue/live-badge.tsx` | Red `animate-ping` dot + "LIVE · updated 8s ago". Turns muted ("Paused") when polling stops |
| `StatTile` | `components/stat-tile.tsx` | Micro label + Oswald 32–40px number + hint + optional slot (bar or badge). Replaces the current dashboard cards |
| `PageHeader` | `components/page-header.tsx` | Micro-label kicker + Oswald title + description + actions slot. Used on every page |
| `ConfirmDialog` | `components/confirm-dialog.tsx` | `AlertDialog` wrapper with a `danger` variant: deactivate, remove leave, no-show, cancel token, close queue |
| `NowServingPanel` | `components/queue/now-serving-panel.tsx` | Board-style dark panel (`board-*` colours): `NOW SERVING` micro label, cream Oswald digits `clamp(48px, 6vw, 96px)`, counter number, and the in-service citizen's name. A brand top border flashes for 10 s after a change |
| `CapacityBar` | `components/queue/capacity-bar.tsx` | `issued / capacity` as a thin ink bar. Amber at ≥ 90%. A red `OVER` stamp when issued > capacity. Stamps for `CLOSED TODAY` (holiday or week-off) and `NO STAFF` |

## 3. Pages
Every page is client-rendered against `/api/v1/*` and has a Skeleton in its final shape, an empty state with a clear action, and an inline error with Retry. Desktop first (1280–1440), still usable at 1024, and the sidebar becomes a sheet below 768.

### Auth: `(auth)/layout.tsx`, `sign-in`, `sign-up` (restyle only)
- Cream background with grain.
- Header: the "UG" mark as a red **stamp** square, "UGSP Backoffice" in Oswald, and the micro label "STAFF CONSOLE · AUTHORISED PERSONNEL".
- The current gradient blobs go.
- Forms stay as built (react-hook-form + zod); the sera underline inputs get the new ink and border colours.

### Shell: `components/app-sidebar.tsx`, `site-header.tsx`, `nav-user.tsx`
- **Sidebar:** cream.dark background, ink text, micro-label group headings. The active item gets an accent background plus a 2px ink left rule. The "UG" logo square is the brand stamp.
- **Header:**
  - micro-label breadcrumb (as now);
  - on the right, today's date as a micro label ("SAT · 10 OCT 2026") and the role pill;
  - `LiveBadge` on pages that poll (Dashboard, Queue console).
- **User menu:** adds **Change password**, which opens a dialog.

### Dashboard `(admin)/dashboard`, both roles
- `PageHeader` "Today" + `LiveBadge`.
- **Row 1, StatTiles:**
  - Issued today (with `CapacityBar`)
  - Waiting (n arrived)
  - In service
  - Completed (n no-show)
- **Row 2, impact StatTiles:**
  - Citizen-minutes saved (with the average in-office wait)
  - ETA accuracy (median, and % within ±15 min)
- **Services today table:**
  - service + department
  - `StatusBadge` queue pill
  - `CapacityBar`
  - waiting / arrived / in service / completed
  - **now serving** in Oswald
  - warning stamps (OVER, NO STAFF, CLOSED TODAY)
- Officers see only their services (API-scoped).

### Departments `(admin)/departments`, `departments/[id]` (team build, restyle + forms)
- Keep the layout. Swap the hard-coded emerald and amber classes for `status-*` tokens.
- Create and edit stay in `DepartmentDialog`, now react-hook-form + zod.
- The hard-delete option and the client search hint for a server search go.
- `[id]`:
  - department "notice card" in the style of frontdesk's OfficeInfo: hours, and the week-off row with off days struck through;
  - `HolidayManager` restyled;
  - a services list linking to Services filtered by that department.
- The recompute `conflicts` from save show as a warning toast.

### Services `(admin)/services`
- `PageHeader` "Services" + **New service** (ink).
- Filters: department `Select`, plus an "Include inactive" switch.
- **Table:**
  - name + code chip
  - department
  - avg min
  - cutoff
  - daily limit
  - booking window
  - alert lead
  - officers (avatar stack, +N)
  - **Today**: `CapacityBar` or a closed / no-staff stamp
  - active `Switch`
  - Edit
- **Create/edit dialog** (react-hook-form + zod, two columns on desktop):
  - department, name, code (uppercased), description
  - avg minutes, cutoff (`type=time`), daily limit, booking window, alert lead minutes
  - **officers**: `Combobox` multi-select with chips
- Deactivating opens a `ConfirmDialog` that mentions live tokens. Recompute conflicts show as a toast.

### Employees `(admin)/employees`
- `PageHeader` "Staff" + **New staff member**.
- Filters: department, role.
- **Table:**
  - name + email
  - role pill (ADMIN filled ink, OFFICER outline)
  - department
  - services chips (+N)
  - **counter** as an Oswald badge `C-03`
  - upcoming leave
  - active `Switch`
  - row menu: Edit · Reset password
- **Create/edit dialog:**
  - name, email
  - initial password (create only, with a show toggle)
  - role, department
  - services (`Combobox` chips)
  - counter number
- **Reset password dialog:** new password + confirm.
- Guard errors (your own account, the last admin) show inline in the dialog.

### Leaves `(admin)/leaves` (replaces Calendar)
- `PageHeader` "Leave" + **Add leave**.
- Filters: department, and "from" date (default today).
- **List grouped by month.** Each row is a stub:
  - left: an ink date block ("12–14 OCT", Oswald);
  - middle: employee, reason and affected services chips;
  - right: the number of days, and Remove (opens a `ConfirmDialog`).
- **Add dialog:**
  - employee `Combobox` with search;
  - date-range `Calendar` (react-day-picker range mode; the employee's existing leave days disabled);
  - reason.
- The save toast reports recompute conflicts ("2 queues now over capacity").

### Queue console `(officer)/queue` (the signature staff screen)
- **Top bar:**
  - `PageHeader` "Queue console" + `LiveBadge` (10 s poll)
  - a search box: token number or phone; a hit highlights and scrolls to the row
  - **service tabs** with a waiting count
- **Hero row** for the selected service:
  - **Left:** `NowServingPanel` with my in-service token, my counter, and a **Complete** button.
  - **Right:** **Call next**, a large brand-red button. It's the "act now" red, disabled with the reason shown when there's nothing ARRIVED, the queue isn't OPEN, or I already have a token in service.
  - Under it: the queue `StatusBadge` and Pause / Close / Reopen (Close opens a `ConfirmDialog`).
- **Lists** (stacked columns on desktop, one column below 1024):
  - **Arrived** (ready to call, in token order): `TokenLabel`, name, last 4 phone digits, arrived time, No-show.
  - **Waiting** (booked, not here yet): `TokenLabel`, name, ETA, **Mark arrived**, No-show, Cancel (`ConfirmDialog`).
  - **Done today** (collapsed): completed, no-show and cancelled, with stamps.
- **Errors:** a 409 from call-next ("You already have a token in service") shows as an inline banner. Actions refetch right away.
- **Empty state:** "No tokens booked for today", with the queue status.

### Dialogs (global)
- **Change password:** current, new, confirm. Lives in the user menu.
- **Reset password:** on Employees.
- **`ConfirmDialog`:** for every destructive or irreversible action.

## 4. Build order (interleaved with the backoffice plan)
1. Theme foundation and shared components. Restyle the auth, shell and dashboard pages, which already exist.
2. Departments restyle and forms, alongside API step 2.
3. Services page after the services API.
4. Employees + password dialogs after the employees API.
5. Leaves page after the leaves API.
6. Queue console after the queue API (use `scripts/seed-tokens.ts` to fill it).
7. Impact tiles after the metrics `impact` block.

## 5. Verification
- `npx tsc --noEmit` and `npm run build`.
- **Visual QA in the browser** at 1440×900, 1024×768 and 375 (sidebar sheet). Check every page in its loading, empty and error states.
- **Theme:** no teal or dark surface is left (grep for `oklch(` and `dark:` usages in the app code). Cream background, ink buttons. Red appears only on Call next, the live dot, stamps and focus rings.
- **Fonts:** headings and numbers in Oswald (tabular), body in Public Sans.
- **Contrast spot-checks** (frontdesk targets): ink on cream ≈ 15:1, muted on cream ≈ 6.5:1, cream on board ≈ 16:1.
- **`prefers-reduced-motion`:** no pulse, reveal or count-fade.

## 6. Cross-app notes (for the frontdesk session; this session doesn't edit `front/`)
- **Palette:** frontdesk keeps its `tailwind.config.ts` (Tailwind v3); backoffice gets the same hex values as CSS variables (Tailwind v4). If a colour changes, change both.
- **Shared logic owner:** the frontdesk plan (`front/_notes/frontdesk-plan.md`, Appendix A) says frontdesk writes `queue-core.ts` first and backoffice copies it. The backoffice plan (owner decision, 2026-10-10) makes **backoffice the master and frontdesk the copy**, like the models. The frontdesk plan needs that line updated.
- **Active employees:** frontdesk's booking rule counts every employee assigned to the service. The shared `queue-core` counts **OFFICERs only**, because admins hold every service in the seed and would inflate capacity. This resolves once frontdesk uses the shared file.
- **Session cookie:** frontdesk asked backoffice to rename its cookie to `bo.session-token`. Added to the backoffice plan's foundations.
