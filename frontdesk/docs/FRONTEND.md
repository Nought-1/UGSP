# UGSP Frontdesk (citizen app)

UGSP (Unified Government Service Platform) is a virtual queuing web app for government offices in India. Citizens book a token remotely, watch a live wait estimate, and arrive only when their turn is near. Staff screens (departments, services, employees, leaves, queue console, dashboard, notifier) live in the backoffice repo; both apps share one MongoDB.

---

## Technology stack

- **Framework:** Next.js 14 (App Router), TypeScript strict
- **Data:** MongoDB via Mongoose 9 (models and `queue-core.ts` are byte-identical copies of backoffice's)
- **Auth:** next-auth v4, phone + password (Credentials, JWT session cookie `fd.session-token`)
- **Client data:** `@tanstack/react-query`; forms with `react-hook-form` + `zod`
- **Styling:** Tailwind CSS with the "Civic Token Slip" palette
  - Ink `#1E1917` · Red `#C8102E` · Cream `#F6F0E6` · Card `#FFFDF8` · Border `#E2D8C8` · Muted `#5A504A`
  - Board: `#141110` background, cream digits
- **Fonts:** Oswald (headings), Public Sans (body), Noto Sans Devanagari / Gujarati (Hindi and Gujarati text)
- **Languages:** English, Hindi, Gujarati (`src/lib/i18n.ts`); dates and times via `Intl`
- **Icons / QR:** `lucide-react`, `qrcode.react`

---

## Running locally

1. `.env` needs `DATABASE_URL` (shared with backoffice), `NEXTAUTH_URL=http://localhost:3005` and `NEXTAUTH_SECRET`.
2. `npm install`, then `npm run dev`, and open `http://localhost:3005`.
3. Create a citizen at `/signup`, or sign in at `/login`.

Booking needs data from backoffice: an active office, an active service, and at least one active OFFICER assigned to that service (only officers count towards capacity).

---

## Screens

| Route | Who | What |
|---|---|---|
| `/` | everyone | Landing; "Book a token" opens the booking modal (or login first) |
| `/login`, `/signup` | everyone | Phone + password; sign-up picks alert channels (SMS / WhatsApp / Email) and an optional email |
| `/citizen/dashboard` | citizen | Live card for the next token (wait, ETA, queue rail, figures) and the office's hours |
| `/citizen/history` | citizen | "My tokens": Upcoming and Past tabs; Cancel on waiting tokens |
| `/citizen/tokens/[id]` | owner | Live status every 10 s: position, people ahead, ETA, now serving, timeline, QR slip, office details, Cancel |
| `/board` | everyone | Office picker for the public boards |
| `/board/[departmentId]` | everyone | Full-screen office TV: now serving and waiting per service, refreshed every 10 s |

**Writes happen in modals**, never on their own pages:
- **Book token** (`components/booking/BookTokenModal.tsx`): search a service grouped by office → pick a day on the calendar (slots left per day; week-offs, holidays and full days disabled) → confirm → the printed slip. It opens from the navbar, dashboard, My tokens and the landing page.
- **Cancel token** (`components/queue/CancelTokenDialog.tsx`): confirm dialog, waiting tokens only.

Alerts (booked, arrive soon, cancelled) are sent by the backoffice notifier; frontdesk only writes the token.

---

## API (`src/app/api/v1`)

| Route | Auth | Purpose |
|---|---|---|
| `POST /signup` | public | Create a citizen |
| `GET /departments` | public | Active offices |
| `GET /services` | public | Active services with their office |
| `GET /services/[id]/availability` | public | Bookable days with slots left and expected time |
| `GET /tokens?status=active\|past`, `POST /tokens` | citizen | My tokens; book |
| `GET /tokens/[id]`, `PATCH /tokens/[id]` | owner | Live status; cancel |
| `GET /board/[departmentId]` | public | Today's now serving per service |

Responses are `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Error codes: `VALIDATION`, `UNAUTHORIZED`, `NOT_FOUND`, `PHONE_TAKEN`, `DATE_NOT_BOOKABLE`, `DATE_FULL`, `ALREADY_BOOKED` (with `tokenId`), `NOT_CANCELLABLE`, `INTERNAL`. The UI shows each code in the active language.

More detail: `AGENT.md` (conventions), `docs/DESIGN-PLAN.md` (screens), `_notes/frontdesk-plan.md` (design and API plan).
