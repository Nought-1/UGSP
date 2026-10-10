# Frontdesk design plan (citizen app)

Status: planned, not built. Decisions confirmed with the product owner on 2026-10-10.

## Rules
- **Writes happen in modals.** Create, update and delete open a `Modal` or `ConfirmDialog` over the current page. No `/new`, `/edit` or `/delete` pages. `/login` and `/signup` are the only exception (see `AGENT.md` §9).
- **UI kit:** keep the current components in `src/components/ui/` (Card, Button, Input, Modal, ConfirmDialog, Badge, Tabs, EmptyState, Skeleton, Toast) and the Tailwind tokens (`brand`, `ink`, `cream`, `muted`, `card`, `border`). No new UI library.
- **Shell:** the current top navbar plus footer. Phone-first, tested at 375 px wide.
- **Languages:** keep English, Hindi and Gujarati. Every string on a new screen goes through `t()` in `src/lib/i18n.ts` with all three translations. Today no page calls `t()` (the switcher only stores a choice), so this is real work on every screen.

## Scope

| # | Scope | Kind | Where |
|---|---|---|---|
| 1 | Login / Sign-up | done | `/login`, `/signup` |
| 2 | Book a token: pick a service (office follows), pick a date, confirm | create | **Book token modal**, opened from anywhere |
| 3 | Dashboard: live active token + office info | read | `/citizen/dashboard` |
| 4 | My tokens: Upcoming and Past | read | `/citizen/history` |
| 5 | Live token status | read | `/citizen/tokens/[id]` |
| 6 | Cancel a token (WAITING only) | update | **Cancel confirm dialog**, opened from token page and My tokens |
| 7 | Public now-serving board | read, public | `/board`, `/board/[departmentId]` |
| 8 | Language switcher (en / hi / gu) | UI | navbar |

**Removed, because they're outside the spec:** the `/citizen/book` page (the region step and gate preview), reschedule, citizen self check-in, the documents checklist, and star ratings in history.

## Pages (read only)

### `/` Landing (public)
- Hero with "Book a token" and "Create account".
  - Signed in: "Book a token" opens the modal.
  - Signed out: it goes to `/login`.
- Three feature cards and a link to `/board`.

### `/citizen/dashboard`
- Header: "Welcome, {name}" and a **Book token** button.
- **Live active token card.** The next live token (WAITING, ARRIVED or IN_SERVICE) dated today or later.
  - Shows the label (e.g. `DL-12`), status badge, date, position, people ahead, live ETA and now serving.
  - Refreshes every 10 s while the page is open. Tapping it opens `/citizen/tokens/[id]`.
- **Office quick info** for that token's office: name, address, city, today's hours, and week-off days.
- Empty state when there is no live token: "No upcoming token" plus Book token.

### `/citizen/history`, labelled "My tokens"
- `Tabs`: **Upcoming | Past**.
- Upcoming rows: label, service, office, date, ETA and status badge.
  - WAITING rows get a **Cancel** button, which opens the cancel dialog.
  - Tapping a row opens the status page.
- Past rows: label, service, office, date, and a COMPLETED, CANCELLED or NO_SHOW badge.
- Each tab has an empty state; Upcoming's includes a Book token button.

### `/citizen/tokens/[id]` Live status
- **Spec basics:** a large token label, status badge, position, people ahead, live ETA, now serving, and a queue notice when PAUSED or CLOSED. It refreshes every 10 s and stops once the status is final (COMPLETED, CANCELLED or NO_SHOW).
- **Status timeline:** WAITING → ARRIVED → IN SERVICE → COMPLETED, with the current step highlighted. CANCELLED and NO_SHOW show as a banner instead.
- **QR code** of the token id (`qrcode.react`, already installed).
- **Office details:** name, address and today's hours.
- A **Cancel** button while WAITING opens the cancel dialog.

### `/board` (public)
- List of active offices (name, city), each linking to its board.

### `/board/[departmentId]` (public, full screen for an office TV)
- No navbar or footer. Office name, date and a live clock.
- A grid of service cards: service name, **NOW SERVING** in large type, waiting count, and queue status (OPEN, PAUSED or CLOSED).
- Refreshes every 10 s.

## Modals

### Book token modal (create)
- Mounted once in `Providers` and opened with `useBookToken().open()`. Callers: navbar button, dashboard, the My tokens empty state, and the landing page. A signed-out user is sent to `/login` instead.
- **Step 1, Service:** a search box over all active services, grouped under office headings (office name, city). Each row shows the service name, average minutes and cutoff time. Picking a service fixes the office.
- **Step 2, Date:** a month calendar.
  - Only the bookable days from availability are enabled, each showing the slots left.
  - Week-offs, holidays, full days and days outside the booking window are disabled.
  - Built as a small month grid with `date-fns` (already installed); a native date input can't disable arbitrary days or show slot counts.
- **Step 3, Confirm:** service, office, date and expected serve time. **Confirm** sends `POST /api/v1/tokens`.
- **Step 4, Success:** the token label, date and estimated serve time, with **View live status** (goes to `/citizen/tokens/[id]`) and **Close**. Refreshes the token lists.
- **Errors** appear inline: `DATE_FULL` and `DATE_NOT_BOOKABLE` reload the calendar, and `ALREADY_BOOKED` links to that token. (Today's time limit is enforced by the shared `bookingCap`, so there is no separate "no time left" error.)

### Cancel token dialog (update)
- `ConfirmDialog`: "Cancel token DL-12 on Mon 12 Oct? Your slot will be released."
- Sends `PATCH /api/v1/tokens/[id]` with `{ action: "cancel" }`. On success it shows a toast and refreshes the token list and status. `NOT_CANCELLABLE` shows "This token can no longer be cancelled".

## Shared changes
- **Status vocabulary:** `TokenStatus` becomes the database enum (WAITING, ARRIVED, IN_SERVICE, COMPLETED, NO_SHOW, CANCELLED). `STATUS_COLORS` and `STATUS_LABELS` in `constants.ts` and the `Badge` status map follow.
- **Types:** `contract-types.ts` gets the response shapes from the API plan (ServiceDTO with office fields, AvailabilityDTO, TokenDTO, TokenStatusDTO with office details, BoardDTO).
- **API client:** `api-client.ts` switches to `/api/v1` and checks `response.status`. `src/mocks/` is deleted once every page uses the real API.
- **Hooks:**
  - `useToken.ts`: status poll and cancel.
  - New `useBooking.ts`: services, availability and book, plus the `useBookToken` modal context.
  - Board queries stay inline in the board page.
- **Chrome:** Navbar and Footer return `null` on `/board/*`.
  - ponytail: a pathname check; move the other pages into a `(site)` route group if more full-screen pages appear.
- **Navbar:** Dashboard, My tokens, a **Book token** button, the language switcher, the user's name and Sign out.

## API needs (changes to the API plan)
- **New** `GET /api/v1/services`: every active service in an active office, with `departmentId`, `departmentName` and `city`, for the service picker.
- `GET /api/v1/departments/[id]/services`: no screen uses it any more; drop it.
- `GET /api/v1/tokens/[id]` also returns the office details (name, address, city, today's hours, week-offs) for the status page and dashboard.
- Unchanged:
  - `GET /api/v1/departments` (board office picker)
  - `GET /api/v1/services/[id]/availability`
  - `POST /api/v1/tokens` and `GET /api/v1/tokens?status=`
  - `PATCH /api/v1/tokens/[id]`
  - `GET /api/v1/board/[departmentId]`

## Build order
1. Status vocabulary, the new types, and the API routes the screens need.
2. Book token modal with the navbar button.
3. Token status page with the cancel dialog.
4. My tokens tabs.
5. Dashboard.
6. Board: office picker and full-screen board.
7. Landing tweaks. Remove `/citizen/book`, the mocks and the out-of-spec bits. Add en/hi/gu strings.

## Verification
- `npx tsc --noEmit` and `npm run build`.
- In the browser at 375 px and at desktop width:
  1. Sign up, then book from the navbar: search a service, choose a calendar day, confirm, and see the success view.
  2. The dashboard card and status page show live numbers.
  3. Cancel from My tokens: the token moves to Past and the slot count goes back up.
- Board at 1920×1080: no navbar, numbers refresh, and nothing needs a login.
- Switching language changes every string on these screens.
