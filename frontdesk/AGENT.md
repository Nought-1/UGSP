# AGENT.md — UGSP Frontdesk (Unified Government Service Platform)

> This file is intended for AI coding agents. Read it fully before touching any file.

---

## 1. Project Overview

**UGSP (Unified Government Service Platform)** is a virtual queue management system for government offices. The brand lives in `APP_NAME` (`src/lib/constants.ts`) and `app.fullName` (`src/lib/i18n.ts`).  
Citizens take a virtual token, see a predicted wait time, and arrive only when their turn is near.

### Users

Frontdesk is the **citizen app only**. Staff screens (departments, services, employees, leaves, queue console, dashboard) live in the backoffice repo.

| Role        | Path prefix    | Description                                     |
|-------------|----------------|-------------------------------------------------|
| Citizen     | `/citizen/**`  | Book tokens, track queue, view history          |

---

## 2. Tech Stack

| Concern         | Library / Tool                              |
|-----------------|---------------------------------------------|
| Framework       | **Next.js 14** (App Router, TypeScript strict) |
| Styling         | **Tailwind CSS v3** + custom design tokens  |
| Data fetching   | **TanStack Query v5** (`@tanstack/react-query`) |
| Forms           | **React Hook Form v7** + **Zod v3**         |
| Icons           | **lucide-react**                            |
| Date utilities  | **date-fns v4**                             |
| Charts          | **recharts**                                |
| QR codes        | **qrcode.react**                            |
| Class merging   | **clsx** + **tailwind-merge**               |
| Database        | **MongoDB** via **Mongoose 9** (`src/lib/db.ts`, `src/lib/models/`) |
| Auth            | **next-auth v4** (Credentials: phone + password, JWT) |

---

## 3. Folder Ownership

```
src/
├── app/                      ← All pages (App Router)
│   ├── (auth)/               ← /login, /signup (phone + password)
│   ├── api/                  ← Route handlers: auth/[...nextauth], v1/*
│   ├── citizen/              ← Citizen pages (login required)
│   │   ├── dashboard/        ← Live active token + office info
│   │   ├── history/          ← "My tokens": Upcoming | Past tabs, cancel dialog
│   │   └── tokens/[id]/      ← Live token status (polls every 10 s)
│   ├── board/                ← Public now-serving boards: office picker + full-screen [departmentId]
│   ├── layout.tsx            ← Root layout (fonts incl. Noto for hi/gu, Providers, Navbar, Footer)
│   ├── page.tsx              ← Landing
│   └── globals.css           ← Global CSS: token slip, stamps, queue rail, board flaps, motion
│
├── components/
│   ├── booking/              ← BookTokenModal (+ BookTokenProvider / useBookToken), ServicePicker, SlotCalendar
│   ├── queue/                ← TokenSlip, QueueRail, StatusTimeline, LivePanel, LiveBadge, StatTile, OfficeInfo, CancelTokenDialog
│   ├── layout/               ← Navbar, Footer, Providers, LanguageSwitcher
│   └── ui/                   ← Design-system primitives (see §6)
│
├── hooks/
│   ├── useToken.ts           ← My tokens, live token status, cancel
│   └── useBooking.ts         ← Services, availability, book
│
├── lib/
│   ├── auth.ts               ← NextAuth options (phone + password), getCitizenId(), password hashing
│   ├── booking.ts            ← Server: availability, book, cancel, status, my tokens, board (uses queue-core)
│   ├── queue-core.ts         ← Capacity / ETA rules (SHARED: byte-identical copy of backoffice lib/queue-core.ts)
│   ├── validators.ts         ← zod schemas shared by forms and API routes
│   ├── api.ts                ← Route response helpers ({ ok, data } / { ok: false, error }), RouteError
│   ├── api-client.ts         ← Browser fetch wrapper for /api/v1 (throws ApiError with `code`)
│   ├── contract-types.ts     ← API response shapes (DTOs)
│   ├── constants.ts          ← App-wide constants
│   ├── db.ts                 ← Mongoose connection (SHARED: identical to backoffice lib/db.ts)
│   ├── models/               ← Mongoose models (SHARED: identical to backoffice lib/models/)
│   ├── format.ts             ← Token label, localised dates/times (Intl), calendar helpers
│   └── i18n.ts               ← en / hi / gu strings, useT() hook
│
└── middleware.ts             ← next-auth guard for /citizen/**
```

> **Do not create files outside these directories** without a clear reason.

---

## 4. Routing & Auth

Citizens sign in with **phone + password** (NextAuth v4 Credentials, JWT session). There is no OTP.

### Public routes (no auth required)
- `/` — Landing
- `/login` — phone + password, `signIn("credentials", ...)`
- `/signup` — `POST /api/v1/signup`, then signs in with the same credentials

### Protected routes
`middleware.ts` guards `/citizen/**` with `withAuth`; signed-out users go to `/login?callbackUrl=...`.  
API routes check the session themselves with `getCitizenId()` from `src/lib/auth.ts`.

### Session
- Client: `useSession()` / `signOut()` from `next-auth/react` (`SessionProvider` is in `Providers.tsx`). `session.user` has `id`, `name`, `phone`.
- Cookie name is `fd.session-token` (`SESSION_COOKIE` in `constants.ts`) so it doesn't clash with backoffice on localhost.
- Phone numbers are stored as E.164; a bare 10-digit number gets `+91` (see `phoneSchema` in `validators.ts`).
- Env: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL` in `.env`.

---

## 5. API Client

**File:** `src/lib/api-client.ts`

```ts
apiClient<T>(endpoint: string, options?: RequestInit): Promise<T>
```

### Behaviour
- Calls hit `BASE_URL = "/api/v1"` with `credentials: "include"` (session cookie). There is no mock layer.
- Responses are `{ ok: true, data }` or `{ ok: false, error: { code, message, ...extra } }`; on failure `apiClient` throws `ApiError` with `code` (e.g. `DATE_FULL`, `ALREADY_BOOKED` with `details.tokenId`).

### Usage pattern
Prefer the hooks in `src/hooks/` (React Query). Underneath:
```ts
const services = await apiClient<ServiceDTO[]>("/services");
const token = await apiClient<TokenDTO>("/tokens", { method: "POST", body: JSON.stringify({ serviceId, date }) });
await apiClient(`/tokens/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
```

### Error handling
Catch `ApiError` and branch on `err.code` when the UI reacts differently (see `BookTokenModal`); otherwise show `err.message`.

---

## 6. Design System & UI Components

All primitive components live in `src/components/ui/`. **Always use these instead of raw HTML elements.**

| Component         | Props of note                                              |
|-------------------|------------------------------------------------------------|
| `Button`          | `variant` (brand/outline/ghost/danger), `size` (sm/md/lg) |
| `Card`            | `hoverable` (adds hover ring), `className` for overrides   |
| `Input`           | `label`, `error`, `icon`, `type`                           |
| `Select`          | `label`, `error`, `options: {value, label}[]`              |
| `Badge`           | `variant` (brand/low/medium/high/danger), `size`           |
| `Modal`           | `isOpen`, `onClose`, `title`                               |
| `ConfirmDialog`   | `isOpen`, `onConfirm`, `onCancel`, `message`               |
| `Skeleton`        | `variant` (text/card/circle), `className`                  |
| `Table`           | `columns`, `data`, `isLoading`                             |
| `Tabs`            | `tabs: {id, label}[]`, `activeTab`, `onChange`             |
| `Toast`           | Triggered via `useToast()` hook                            |
| `EmptyState`      | `icon`, `title`, `description`, `action`                   |

### Tailwind Design Tokens (custom colours)
Defined in `tailwind.config.ts`:

| Token     | Usage                              |
|-----------|------------------------------------|
| `brand`   | Primary accent (indigo-ish)        |
| `ink`     | Main text colour                   |
| `muted`   | Secondary / placeholder text       |
| `cream`   | Background tint / section fills    |
| `border`  | Default border colour              |
| `card`    | Card background                    |

Use these tokens consistently. **Do not use raw Tailwind colour names like `blue-500`** unless absolutely necessary.

### Search Bars (inline pattern)
All search bars in Step 1/2/3 of the booking wizard use a raw `<input>` with a consistent class pattern:
```tsx
<div className="relative flex items-center">
  <Search className="absolute left-3.5 w-4 h-4 text-muted pointer-events-none" />
  <input
    type="text"
    placeholder="Search…"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full h-11 pl-10 pr-4 bg-card border border-border rounded-lg text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
  />
  {searchQuery && (
    <button onClick={() => setSearchQuery("")} className="absolute right-3.5 text-muted hover:text-ink transition-colors">
      ✕
    </button>
  )}
</div>
```
Replicate this exact pattern for any new search bars to stay consistent.

---

## 7. API routes (`src/app/api/v1`)

| Route | Auth | Purpose |
|---|---|---|
| `POST /signup` | public | Create a citizen |
| `GET /departments` | public | Active offices (board picker) |
| `GET /services` | public | Every active service with its office (book token picker) |
| `GET /services/[id]/availability` | public | Bookable days with slots left |
| `GET /tokens?status=active\|past`, `POST /tokens` | citizen | My tokens, book |
| `GET /tokens/[id]`, `PATCH /tokens/[id]` | owner | Live status, cancel |
| `GET /board/[departmentId]` | public | Today's now-serving per service |

Rules: logic lives in `src/lib/booking.ts`; every GET exports `dynamic = "force-dynamic"`; Next 14 `params` are sync; capacity / ETA rules come only from the shared `queue-core.ts` (change it in backoffice first, then copy).

---

## 8. TypeScript Conventions

- **Strict mode** is enabled (`tsconfig.json`).
- All shared types live in `src/lib/contract-types.ts`. Import from there, never re-declare.
- Prefer `interface` for objects, `type` for unions/intersections.
- Always type async functions explicitly: `async function foo(): Promise<Bar>`.
- Avoid `any`. Use `unknown` and narrow it.

---

## 9. Forms Pattern

Use **React Hook Form + Zod** for all forms:

```ts
const schema = z.object({ phone: z.string().min(10) });
type FormData = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

Pass `error={errors.phone?.message}` to `<Input />`.

### Writes happen in modals (project rule)

Every **create, update or delete** action opens in a modal over the current page. There are no `/new`, `/edit` or `/delete` pages.

- Forms (create, edit) go in `<Modal />` from `src/components/ui/Modal.tsx`, with the RHF + zod pattern above.
- Destructive or one-click actions (cancel a token) use `<ConfirmDialog />` from `src/components/ui/ConfirmDialog.tsx`.
- Pages only list and show data. A modal can be opened from any page, for example "Book token" from the navbar, dashboard or token history.
- Exception: `/login` and `/signup` stay as pages.

---

## 10. Running the Project

```bash
# Install dependencies
npm install

# Start dev server on :3005 (talks to MongoDB through DATABASE_URL)
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

The dev server runs on **http://localhost:3005**.

### Environment Variables (`.env`, gitignored)

| Variable          | Purpose                                         |
|-------------------|-------------------------------------------------|
| `DATABASE_URL`    | MongoDB connection (shared with backoffice)     |
| `NEXTAUTH_URL`    | `http://localhost:3005`                         |
| `NEXTAUTH_SECRET` | Random secret for signing session cookies       |

---

## 11. What NOT to Do

- ❌ Do **not** create pages for create / update / delete actions. Use a modal (see §9).
- ❌ Do **not** install new packages without updating `AGENT.md`.
- ❌ Do **not** use raw Tailwind colours (`blue-500`, `green-400`). Use design tokens.
- ❌ Do **not** duplicate types from `contract-types.ts`.
- ❌ Do **not** add business logic to UI components in `src/components/ui/`.
- ❌ Do **not** use `any` in TypeScript.
- ❌ Do **not** commit `.env.local` or secrets.

---

## 12. Key Files Quick Reference

| File | Purpose |
|------|---------|
| [`src/lib/api-client.ts`](./src/lib/api-client.ts) | All HTTP calls — entry point for API communication |
| [`src/lib/contract-types.ts`](./src/lib/contract-types.ts) | API response shapes |
| [`src/lib/booking.ts`](./src/lib/booking.ts) | Server booking logic |
| [`src/lib/queue-core.ts`](./src/lib/queue-core.ts) | Shared capacity / ETA rules (copy of backoffice master) |
| [`src/lib/auth.ts`](./src/lib/auth.ts) | NextAuth config (phone + password) |
| [`src/lib/i18n.ts`](./src/lib/i18n.ts) | en / hi / gu strings, `useT()` |
| [`src/hooks/useToken.ts`](./src/hooks/useToken.ts) | My tokens, live status, cancel |
| [`src/hooks/useBooking.ts`](./src/hooks/useBooking.ts) | Services, availability, book |
| [`src/components/booking/BookTokenModal.tsx`](./src/components/booking/BookTokenModal.tsx) | Book token modal, opened from anywhere via `useBookToken()` |
| [`src/middleware.ts`](./src/middleware.ts) | next-auth guard for `/citizen/**` |
| [`tailwind.config.ts`](./tailwind.config.ts) | Design tokens |
| [`src/app/globals.css`](./src/app/globals.css) | Global CSS |
