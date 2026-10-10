# Frontdesk design specification: "Civic Token Slip"

## Context
This is the frontend-design pass over the confirmed screen plan in `front/docs/DESIGN-PLAN.md`. It is a **design only** pass: no code is changed in this step, and the build follows after approval. The partial code from the interrupted build step is already reverted (stubs are back, `useBooking.ts` and `api/v1/services` are gone).

**Fixed constraints:**
- **UI kit:** keep the current kit in `src/components/ui/` (Card, Button, Input, Modal, ConfirmDialog, Badge, Tabs, EmptyState, Skeleton, Toast) and the top navbar.
- **Palette and fonts:** ink, cream and brand red; Oswald for display, Public Sans for body.
- **Writes:** create, update and delete happen only in modals (`AGENT.md` §9).
- **Languages:** en / hi / gu through `t()`.

Users are citizens on cheap phones, outdoors, often anxious about losing their turn. The design has to answer "how long, and when do I leave?" at a glance.

## 1. Direction
**Concept: the token is a physical object.** In Indian government offices a token is a narrow thermal-paper slip from a machine. The app turns that slip into the hero of every screen. Around it sits a quiet "government form" layer:
- warm cream paper, near-black brown ink, and government red used like a rubber stamp;
- printed-form micro labels such as `NOW SERVING` and `PEOPLE AHEAD`.

The public board flips to the opposite world: a dark **railway departure board** with big cream split-flap digits.

**Tone:** editorial-civic print. High-contrast condensed type, generous paper space, very few colours. Red appears **only** for "you", "act now" and stamps, so it never becomes decoration.

**What people should remember:**
1. **The token slip**: a perforated slip with a huge `DL-012`, a tilted red status stamp and a QR code on the tear-off stub.
2. **The queue rail**: a track from the counter (now serving) to **you**, with one dot per person ahead. The dots melt away as the queue moves.

## 2. Design tokens (extend `tailwind.config.ts` and `globals.css`; no new libraries)
**Colours (existing):**
- Background: `cream #F6F0E6`
- Paper: `card #FFFDF8`
- Ink: `ink #1E1917` / `ink.dark #141110`
- Rules: `border #E2D8C8` / `border.dark #C6B9A5`
- Secondary text: `muted #5A504A`
- Stamp: `brand #C8102E`
- Status: `status.*` (done = green, pending = amber, cancelled = red, called = blue)

**Additions:**
- `board.bg #141110`, `board.tile #1E1917`, `board.rule #2C2623`, `board.digit #F6F0E6`, `board.dim #847770`
- `stamp` alias = `brand`

**Status to colour:**

| Status | Colour | Style |
|---|---|---|
| WAITING | ink | outline stamp |
| ARRIVED | called blue | |
| IN_SERVICE | brand | filled, with a pulse |
| COMPLETED | done green | |
| CANCELLED / NO_SHOW | cancelled red | struck through |
| Queue OPEN / PAUSED / CLOSED | green / amber / red | pills |

**Typography:**
- **Display:** Oswald 600/700, uppercase where it acts as a label, letter spacing 0.02–0.06em.
- **All numbers:** `tabular-nums`.
- **Sizes:**
  - Slip label: 64px on mobile, 96px on desktop.
  - Wait time: 56px.
  - Board digits: `clamp(72px, 9vw, 168px)`.
- **Micro labels** (the "printed form" voice): Public Sans 600, 11px, uppercase, letter spacing 0.18em, `muted`.
- **Body:** Public Sans 400/600, 14–16px.
- **Hindi and Gujarati:** Oswald has no Devanagari or Gujarati glyphs. Add **Noto Sans Devanagari** and **Noto Sans Gujarati** with `next/font` as fallbacks in both font stacks, so hi/gu headings stay bold and condensed-adjacent instead of dropping to the system font.

**Texture and depth:**
- **Paper grain:** a fixed `body::before` overlay using an SVG `feTurbulence` data URI at opacity 0.035, with `pointer-events: none`.
- **Perforation:** a `2px dashed border.dark` line, plus two semicircle notches made with CSS `mask` radial gradients on `.slip-top` (bottom corners) and `.slip-stub` (top corners). This works on any background.
- **Slip shadow:** `filter: drop-shadow(0 12px 24px rgb(30 25 23 / .12))` on the wrapper, because masks clip `box-shadow`. Corner radius 14px.
- **Stamp:** a 2px border in the status colour, rotated −6°, uppercase Oswald, with a slight `mask` speckle so it reads as ink rather than a flat UI chip.

## 3. Signature components (new, under `src/components/queue/` and `src/components/booking/`)

| Component | Anatomy | Notes |
|---|---|---|
| **TokenSlip** | Header strip (office code · service, date) → giant label `DL-012` → status stamp overlapping the right edge → meta rows ("Expected ~10:40 AM", "Booked Mon 12 Oct") → perforation → stub with a 96px QR (`qrcode.react`, already installed), short id and "Show this at the counter" | Variants: `full` (status page), `compact` (booking success, no stub), `specimen` (landing, rotated −2°). CANCELLED or NO_SHOW: a large diagonal red outline stamp across the slip, and the slip at 70% opacity |
| **QueueRail** | Left anchor "NOW SERVING 007" → a dotted track with one dot per person ahead (up to 18 visible, then a `+N` chip) → right anchor: **YOU** in brand with a pulse | `peopleAhead = 0` collapses to "You're next" in brand. A dot leaving fades and slides left (transition). The whole rail is one `aria-label` sentence |
| **StatusTimeline** | Waiting → Arrived → In service → Completed, connected by a hairline | Done steps: ink check. Current step: brand ring plus bold label. Final CANCELLED or NO_SHOW: no timeline; the slip stamp says it |
| **LiveBadge** | Red dot (`animate-ping`) + "LIVE · updated 8s ago" from `dataUpdatedAt` | It turns muted, "Paused", when polling stops |
| **StatTile** | Micro label + Oswald 32–40px number | Position, people ahead, now serving, wait |
| **OfficeInfo** | A "printed notice" card: office name (Oswald), address, today's line "Open 9:00 AM – 5:00 PM" or **Closed today** in red, and a row of 7 weekday initials with off-days struck through | Weekday names come from `Intl` in the active language |
| **SlotCalendar** | Month grid with a localised weekday header (`Intl`), 44px cells, the day number with slots left under it in small Oswald ("14 left") | ≤3 slots: amber. Selected: ink background, cream text. Today: brand ring. Non-bookable: `muted/35`, not focusable. Month arrows only inside the booking window. Legend: "Number below date = slots left" |
| **ServicePicker** | Sticky search `Input` (search icon) above a list grouped by office: a sticky office header (Oswald, uppercase, city) and service rows (name, code chip, "≈12 min each · last token 4:30 PM", chevron) | Search matches service name, code, office and city. "No service matches" empty state |
| **BookTokenModal** | `Modal maxWidth="lg"`. A step strip under the header shaped like a perforation, with three ticks: Service — Date — Confirm. Footer: Back (outline) / Continue (primary) | Opened from anywhere with `useBookToken().open()`, mounted once in `Providers`. Signed-out users go to `/login?callbackUrl=` |
| **CancelTokenDialog** | `ConfirmDialog variant="danger"`: "Cancel token DL-012 on Mon 12 Oct? Your slot is released and the number isn't reused." | Success: toast "Token cancelled" |

## 4. Screens
Every screen is designed for 375px first, then desktop at `max-w-7xl`. Every data block has a Skeleton in its final shape (not spinners), an EmptyState with a clear action, and an inline error with Retry.

### Landing `/`
- **Asymmetric hero.** Left 7 of 12 columns:
  - kicker micro label "GOVERNMENT OFFICES · VIRTUAL QUEUE";
  - H1 Oswald 48px (mobile) / 88px (desktop): "Take your token from home. Walk in when it's **your turn**." with "your turn" underlined by a brand-red hand-drawn SVG stroke;
  - CTAs: **Book a token** (primary; opens the modal when signed in, otherwise goes to `/login`) and **Create account** (outline).
- **Hero, right 5 columns:** a `specimen` TokenSlip rotated −2°, overlapped by a small QueueRail card offset down and left, with a red "LIVE" stamp.
- **How it works:** three editorial rows with huge outlined Oswald numerals 01 / 02 / 03 (Book, Get an alert, Walk in), each with one sentence.
- **Board band:** a full-width dark band, "See what's being served right now → Live boards".
- **Load motion:** staggered reveal: kicker, H1, CTAs, then the slip "prints" in.

### Navbar (existing, extended)
- Right side: **Book token** (brand, ticket icon), the language switcher, then the user's name and sign-out.
- Signed out: "Live boards" and Sign in.
- Mobile drawer: Book token as the full-width first item.

### Dashboard `/citizen/dashboard`
- **Header:** a localised greeting ("Namaste, Asha"), today's date as a micro label, and Book token.
- **Live active token card** (the whole card links to the status page). Desktop: an 8-column card split into two parts.
  - **Left, a slip panel:** label, service, office, date.
  - **Right, the live panel:**
    - LiveBadge;
    - wait "~25 min" in 56px Oswald, with "at 10:40 AM" below;
    - QueueRail;
    - three StatTiles.
  - Mobile: one column, with the live panel first.
- **When the token isn't today:** "Booked for Mon 12 Oct · expected 10:40 AM" and "{n} booked before you". The rail is hidden because the queue hasn't started.
- **OfficeInfo:** a 4-column side card on desktop; below the token on mobile.
- **More upcoming:** a "+2 more upcoming → My tokens" link.
- **Empty state:** a dashed outline of a blank slip, "No token yet", and Book token.

### My tokens `/citizen/history`
- Title "My tokens", then `Tabs`: **Upcoming (n) | Past (n)**.
- **Rows are horizontal stubs:**
  - left: an ink block with the cream Oswald label;
  - middle: service, office, and date · ETA;
  - right: the status stamp, plus a **Cancel** ghost-danger button for WAITING tokens (opens the cancel dialog).
  - The whole row links to the status page; the Cancel button stops the click from reaching the row.
- **Past rows:** 80% opacity, no cancel.
- **Empty states:** Upcoming offers Book token; Past says "Completed and cancelled tokens appear here".

### Token status `/citizen/tokens/[id]`
- **Desktop, 12 columns:**
  - Left 5 columns: TokenSlip `full`, sticky.
  - Right 7 columns:
    - LiveBadge, the wait in 56px and "at 10:40 AM";
    - QueueRail;
    - StatTiles (position, people ahead, now serving);
    - a queue notice when the queue is PAUSED (amber: "Counter paused, your ETA may move") or CLOSED (red);
    - StatusTimeline;
    - OfficeInfo;
    - **Cancel token** (danger outline) while WAITING.
- **Mobile order:** wait and rail first (the answer), then the slip with its QR, timeline, office, and Cancel.
- **State banners:**
  - IN_SERVICE: a full-width brand banner "It's your turn, go to the counter" with a pulse.
  - ARRIVED: an ink banner "You're checked in, wait for your number".
  - Final states: polling stops, the live panel becomes a summary ("Completed at 10:52 AM"), and the slip gets its stamp.
- **Updates:** the wait and position sit in an `aria-live="polite"` region. A number that changes animates with a short count-fade.

### Board picker `/board` (public)
- Title "Live boards" and a grid of office cards: name (Oswald), city, and an "Open today" / "Closed today" pill.
- Hovering a card reveals a dark strip with a preview of now-serving digits.

### Board `/board/[departmentId]` (public, office TV)
- A `fixed inset-0` dark screen that covers the navbar and footer, so no layout change is needed.
- **Header:** the office name huge on the left with the city; the date and a live clock (Oswald, tabular) on the right.
- **Grid** of service tiles: 2 columns at 1280px, 3–4 at 1920px.
- **Each tile:**
  - service name in cream at 80% uppercase, and its code;
  - the micro label `NOW SERVING`;
  - **split-flap digits**: each character on its own two-half card with a hairline at the middle, and a `rotateX` flip when the value changes;
  - bottom row: "12 waiting" and the status pill.
  - A tile whose number changed in the last 10 s gets a brand top border.
- **No tokens today:** the tile shows "— —" and "No tokens yet".
- **Footer ticker:** a slow marquee, "Book your token online · Arrive when your turn is near", plus "Updated 3s ago".
- Refreshes every 10 s. Minimum type size is 28px so it reads from 5 m.

### Book token modal (the only write UI besides cancel)
- **Service:** ServicePicker, then the selected service as a compact card with a "Change" link.
- **Date:** SlotCalendar. The selected day shows "Expected around 10:40 AM · 14 slots left".
- **Confirm:** a receipt-style summary with dotted leaders (service, office, date, expected time) and **Confirm booking**.
- **Success:** the compact TokenSlip "prints" out of a slot (clip-path reveal and translateY over 450ms), "You're in the queue", then **View live status** (primary) and **Close**.
- **Errors:**
  - `DATE_FULL` / `DATE_NOT_BOOKABLE`: an amber inline note, and the calendar reloads.
  - `ALREADY_BOOKED`: a note with a link to that token.

## 5. Motion (CSS only, no new library)
- **Page load:** a `.reveal` class (slide-up 10px plus fade, 500ms `cubic-bezier(.16,1,.3,1)`, `both`) staggered 60ms across at most 5 blocks per screen.
- **Live values:** a changed number is remounted by `key` and plays a 250ms count-fade. Board digits play the flip.
- **Slip print:** on booking success and on the landing hero.
- **Rail:** dots transition out. The YOU marker pulses (2s).
- **`prefers-reduced-motion`:** no flips, pulses, prints or marquee. Values just swap.

## 6. Accessibility
- **Contrast:** ink on cream ≈ 15:1, muted on cream ≈ 6.5:1, brand on paper ≈ 5.6:1 (used for bold or ≥14px text only), cream on board background ≈ 16:1.
- **Touch and focus:** 44px minimum targets (the kit already does this) and visible brand focus rings.
- **Calendar:** cells are buttons with labels like "Mon 12 Oct, 14 slots left". Non-bookable days are disabled.
- **Live regions:** `aria-live="polite"` on the status wait and position; no live region on the board (it's a TV).
- **Modal:** it currently has no focus trap. Focus the first field when a step opens, and return focus to the trigger on close.

## 7. Language
- Every string goes through `t()`. A `useT()` hook re-renders on `language-changed` (the key already exists in the switcher) and starts in English, so the server and client render the same first.
- Dates, times, weekday and month names come from `Intl` with `en-IN`, `hi-IN` and `gu-IN`, so none of them need hand translation. Digits stay Latin (`numberingSystem: "latn"`) so token numbers match the printed slip and the board.
- The "Namaste" greeting and the micro labels get proper hi/gu strings, not transliterations.

## 8. Build files (for the build step after approval)
- **CSS and config:** in `globals.css` add the grain, `.slip-top`/`.slip-stub` masks, `.stamp`, `.reveal`, the flip and print keyframes, and a reduced-motion block. Add the `board.*` colours in `tailwind.config.ts`. Add the Noto fallbacks in `src/app/layout.tsx`.
- **New components:**
  - `src/components/queue/`: `TokenSlip`, `QueueRail`, `StatusTimeline`, `LiveBadge`, `StatTile`, `OfficeInfo`, `CancelTokenDialog`.
  - `src/components/booking/`: `BookTokenModal` (with its provider and hook), `ServicePicker`, `SlotCalendar`.
- **Pages to rewrite:** `src/app/page.tsx`, `citizen/dashboard`, `citizen/history`, `citizen/tokens/[id]`.
- **Pages to add:** `board/page.tsx` and `board/[departmentId]/page.tsx`.
- **Delete:** `citizen/book`.
- **Data:** this design needs the API from Appendix A, plus `GET /api/v1/services` and office details in `GET /api/v1/tokens/[id]`, as listed in `docs/DESIGN-PLAN.md`.

## 9. Verification (after the build)
- `npx tsc --noEmit` and `npm run build`.
- **Visual QA in the browser pane:**
  - 375×812 and 1440×900 for landing, dashboard, My tokens, token status and the booking modal.
  - 1920×1080 for the board.
  - Each screen in its loading, empty and error states.
- Switch to hi and gu: headings render in Noto rather than tofu or the system font, and dates and weekdays are localised.
- Turn on `prefers-reduced-motion` in DevTools rendering: no flips or pulses.
- Contrast spot-check with DevTools.

---

# Appendix A: Frontdesk API plan (`front/`, Next 14, Mongoose)

## Context
The other session ("Backoffice and frontdesk folders") moved both repos from Prisma to Mongoose. Frontdesk now has `src/lib/db.ts` and `src/lib/models/*`. These are uncommitted and byte-identical to backoffice, with `citizen.passwordHash`, `citizen_token.bookedServeAt` and the "one live token per citizen per queue" partial unique index.

Frontdesk still has **no API at all**:
- `src/app/api` doesn't exist.
- `api-client.ts` sends every call to `mocks/` unless it's a production build.
- The mock contract is the old OTP/region/gate design.
- `next-auth` is not installed, the middleware protects nothing, and no form uses RHF + zod.

Goal: real citizen API routes on the spec (sections 5–7), with NextAuth phone + password, zod on both sides, and mocks removed.

## Decisions
| Topic | Choice | Why |
|---|---|---|
| Base path | `/api/v1/*` (change `BASE_URL` in `api-client.ts`) | Same as backoffice. NextAuth keeps `/api/auth/*` |
| Envelope | Keep frontdesk's `{ ok: true, data } \| { ok: false, error: { code, message } }` | `api-client.ts` already unwraps it, and error codes drive the UI. The apps never call each other, so they don't need the backoffice shape |
| Auth | NextAuth v4 Credentials (phone + password), JWT, cookie `fd.session-token` | Spec decision. A custom cookie name avoids a clash with backoffice on localhost |
| Password hash | `node:crypto` scrypt | No new dependency. Only frontdesk reads citizen hashes |
| Phone | E.164 (`+919876543210`), zod regex | SMS and WhatsApp need it. The UI can prefix `+91` |
| Notifications | Frontdesk only writes tokens. The backoffice notifier sends BOOKED and CANCELLED | Provider keys stay in one app (agreed architecture) |
| Over-booking guard | Atomic `$inc` guarded by `issuedCount < capacity`, then insert the token. If the insert fails, decrement again | Upgrade path: a Mongo transaction (Atlas is a replica set) if a phantom count is ever seen |
| Timezone | `Intl.DateTimeFormat` helpers | No `date-fns-tz` dependency |
| Next 14 params | `{ params: { id } }` is sync | Backoffice (Next 16) uses `await params`. Don't copy that style |

## Endpoints
| Method | Path | Auth | Replaces (mock) | Response `data` |
|---|---|---|---|---|
| GET, POST | `/api/auth/[...nextauth]` | public | `/auth/send-otp`, `/auth/verify-otp`, `/auth/me`, `/auth/logout` | NextAuth (`signIn`, `signOut`, `useSession`) |
| POST | `/api/v1/signup` | public | `/auth/register/citizen` | `{ id, name, phone }` |
| GET | `/api/v1/departments` | public | `/regions`, `/departments?regionId` | `DepartmentDTO[]` (active only) |
| GET | `/api/v1/departments/[id]/services` | public | same path | `ServiceDTO[]` (active only) |
| GET | `/api/v1/services/[id]/availability` | public | `POST /tokens/preview` (gate) | `AvailabilityDTO` |
| POST | `/api/v1/tokens` | citizen | same path | `TokenDTO` (201) |
| GET | `/api/v1/tokens?status=active\|past` | citizen | `/tokens/mine?status=` | `TokenDTO[]` |
| GET | `/api/v1/tokens/[id]` | owner | same path | `TokenStatusDTO` (polled every 10 s) |
| PATCH | `/api/v1/tokens/[id]` `{ action: "cancel" }` | owner | same path | `TokenDTO` |
| GET | `/api/v1/board/[departmentId]` | public | (new, extra) | `BoardDTO` |

Dropped, no replacement: reschedule (out of scope, cancel and rebook instead) and `POST /tokens/:id/check-in` (staff marks ARRIVED in backoffice; QR check-in is a stretch goal).

### Shapes (`src/lib/contract-types.ts`, rewritten)
```ts
type TokenStatus = "WAITING" | "ARRIVED" | "IN_SERVICE" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
interface DepartmentDTO { id; name; code; address?; city?; workingHours: { start; end }; weekOffDays: number[]; timezone }
interface ServiceDTO    { id; departmentId; name; code; description?; avgServiceMinutes; cutoffTime; bookingWindowDays }
interface AvailabilityDTO { serviceId; timezone; dates: { date; slotsLeft; expectedServeAt /* ISO, if booked now */ }[] }   // bookable dates only
interface TokenDTO { id; label /* `${service.code}-${tokenNumber}` */; tokenNumber; status: TokenStatus; date;
                     serviceId; serviceName; departmentId; departmentName; estimatedServeAt; bookedServeAt; createdAt }
interface TokenStatusDTO { token: TokenDTO; queueStatus: "OPEN"|"PAUSED"|"CLOSED"; nowServing; peopleAhead; position; liveEtaAt; waitMin }
interface BoardDTO { departmentId; departmentName; date; services: { serviceId; name; code; queueStatus; nowServing; waiting; completed }[] }
```

### Error codes
`UNAUTHORIZED` 401 · `VALIDATION` 400 · `NOT_FOUND` 404 · `PHONE_TAKEN` 409 · `DATE_NOT_BOOKABLE` 409 · `DATE_FULL` 409 · `ALREADY_BOOKED` 409 · `NOT_CANCELLABLE` 409 · `INTERNAL` 500

## Booking rules (`src/lib/booking.ts`)
**Availability.** For each date from today to today + `bookingWindowDays` − 1, in the department's timezone:
1. Skip the date if it is a week-off or a holiday.
2. `activeEmployees` = count of employees with `isActive`, the service in `serviceIds`, and no leave whose `from <= date <= to`. Skip the date if it is 0.
3. `capacity` = `min(dailyTokenLimit, floor(activeEmployees × minutes / avgServiceMinutes))`, where minutes runs from `max(now, opening)` (today) or `opening` (future dates) to `cutoffTime`.
4. `slotsLeft` = `capacity − queue.issuedCount` (0 if there is no queue yet). Skip the date if `slotsLeft <= 0`, or if it is today and now is past the cutoff.
5. `expectedServeAt` = `max(now, opening) + ceil(liveTokens / activeEmployees) × avg`.

**Book** (`POST /tokens`, body `{ serviceId, date }`):
1. Re-run the availability checks for that date. If it fails, return `DATE_NOT_BOOKABLE`.
2. Look for an existing live token (same citizen, service and date). If there is one, return `ALREADY_BOOKED`.
3. `ServiceQueue.findOneAndUpdate({ serviceId, date }, { $setOnInsert: { departmentId, activeEmployees, capacity } }, { upsert: true, new: true })`. On E11000 from a concurrent upsert, retry once.
4. `ServiceQueue.findOneAndUpdate({ _id, status: { $ne: "CLOSED" }, $expr: { $lt: ["$issuedCount", "$capacity"] } }, { $inc: { issuedCount: 1, lastTokenNumber: 1 } }, { new: true })`. If it returns null, return `DATE_FULL`.
5. Compute the ETA from `peopleAhead` (live tokens with a lower number). **Superseded:** today's time limit is enforced atomically by backoffice's shared `bookingCap` inside `reserveSlot`, so there is no `NO_TIME_LEFT` step (see `latest/_notes/backoffice-plan.md`).
6. `CitizenToken.create({ ..., tokenNumber: lastTokenNumber, estimatedServeAt: eta, bookedServeAt: eta })`. If that fails (E11000 means a race on the live-token index), decrement `issuedCount` and return `ALREADY_BOOKED`. `lastTokenNumber` is never decremented, so a gap in numbers is fine.

**Cancel:**
1. `CitizenToken.findOneAndUpdate({ _id, citizenId, status: "WAITING" }, { status: "CANCELLED" })`. If it returns null, return `NOT_CANCELLABLE`.
2. Decrement the queue's `issuedCount`.

**Live status** (read-only; the notifier persists `estimatedServeAt`): `peopleAhead` = live tokens in the queue with a lower `tokenNumber`, and `liveEtaAt` uses the same ETA formula. Return 404 unless `token.citizenId` is the session's citizen.

**My tokens:**
- `active` = WAITING, ARRIVED or IN_SERVICE, and `date >= today` in the department's timezone.
- `past` = everything else.
- Join service and department names with two `$in` lookups, not per-token queries.

## Files (front/)
```
package.json                                  [edit] + next-auth@^4.24
.env                                          [edit] + NEXTAUTH_URL=http://localhost:3005, NEXTAUTH_SECRET
AGENT.md                                      [edit] drop "no src/app/api" rule and mock instructions; document routes, envelope, auth
src/middleware.ts                             [edit] next-auth withAuth, matcher /citizen/:path*, cookie fd.session-token
src/types/next-auth.d.ts                      [new]  session.user.id
src/app/api/auth/[...nextauth]/route.ts       [new]  NextAuth(authOptions)
src/app/api/v1/signup/route.ts                [new]
src/app/api/v1/departments/route.ts           [new]
src/app/api/v1/departments/[id]/services/route.ts [new]
src/app/api/v1/services/[id]/availability/route.ts [new]
src/app/api/v1/tokens/route.ts                [new]  GET list, POST book
src/app/api/v1/tokens/[id]/route.ts           [new]  GET status, PATCH cancel
src/app/api/v1/board/[departmentId]/route.ts  [new]
src/lib/auth.ts                               [new]  authOptions (phone+password), getCitizenId(), scrypt hash/verify
src/lib/api.ts                                [new]  ok(data, status?), fail(code, message, status), zod-error → VALIDATION
src/lib/validators.ts                         [new]  zod: signup, login, book, tokenAction, tokenListQuery (shared with RHF forms)
src/lib/queue-core.ts                         [new]  SHARED (keep-in-sync header like models): todayIn(tz), zonedDate(date, HH:mm, tz),
                                                     isWorkingDay(dept, date), countActiveEmployees(serviceId, date), capacity(), eta()
src/lib/booking.ts                            [new]  getAvailability, bookToken, cancelToken, getTokenStatus, listMyTokens
src/lib/api-client.ts                         [edit] BASE_URL "/api/v1", delete mock branch, check response.status
src/lib/contract-types.ts                     [edit] replace with DTOs above
src/hooks/useToken.ts                         [edit] drop checkIn/reschedule; keep 10 s poll + cancel
src/hooks/useAuth.ts                          [del]  → next-auth useSession / signIn / signOut
src/components/layout/Providers.tsx           [edit] + SessionProvider
src/mocks/                                    [del]
```
Pages (not API, but they break without these changes): login (phone + password, RHF), `register/citizen` → `signup`, the book wizard (drop the region and gate steps, use availability), dashboard and history (`/tokens?status=`, new field names), token page (drop check-in and reschedule), and Navbar (`useSession`). Staff, manager and admin pages, and `pending-approval`, get deleted as agreed in the earlier plan.

## Backoffice dependencies (other session or teammate)
1. `queue-core.ts` gets written in frontdesk first, then copied byte-identical to `latest/lib/queue-core.ts` for `recompute.ts` and the notifier.
2. The notifier must send BOOKED and CANCELLED for tokens whose `notifications[]` lacks that event, plus ARRIVE_SOON as specified.
3. Backoffice should rename its own session cookie (`bo.session-token`) as well.

## Build order
1. `next-auth` install, `auth.ts`, `api.ts`, `validators.ts`, signup + NextAuth route, middleware, Providers.
2. `departments`, `services`, and `queue-core.ts` + availability.
3. `booking.ts`: book, list, status, cancel.
4. Board.
5. Delete mocks and `useAuth`; update `api-client`, `contract-types`, hooks and AGENT.md.

## Verification
- `npx tsc --noEmit` and `npm run build` in `front/`.
- One self-check script for `queue-core.ts` (asserts on capacity, ETA, week-off and holiday skipping, and timezone "today").
- Run against a **throwaway DB name** in `DATABASE_URL`, not the shared one. Seed one department, two services and two officers (one on leave).
- End to end in the browser at :3005: sign up → log in → departments → services → availability (the week-off, holiday and leave days are missing) → book → token page shows position and ETA → cancel → slot count goes back up.
- Race: fire 20 parallel `POST /tokens` from different citizens at a service with capacity 5. Expect exactly 5 successes, numbers 1–5, and `issuedCount` 5.
- Duplicate: the same citizen books twice for the same date and gets `ALREADY_BOOKED`.
- Log in to backoffice (:3000) and frontdesk (:3005) in the same browser; neither session should log the other out.
