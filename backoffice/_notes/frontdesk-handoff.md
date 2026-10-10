# Frontdesk handoff: shared files from backoffice

Backoffice holds the master copy of the shared code (owner decision, 2026-10-10). Frontdesk copies these files **unchanged**; each starts with a "keep both copies identical" header. Last updated with the backoffice foundations step.

## 1. Copy into `front/src/lib/`
| From `latest/` | To `front/` | What changed |
|---|---|---|
| `lib/models/*.ts` | `src/lib/models/*.ts` | `Employee.counterNumber`, `Service.alertLeadMinutes` (default 30), `CitizenToken.counterNumber`, and two token indexes: one IN_SERVICE token per officer per day; `{date, status}` |
| `lib/queue-core.ts` | `src/lib/queue-core.ts` | New: the shared capacity, working-day and ETA rules |
| `lib/db.ts` | `src/lib/db.ts` | Unchanged since the Mongoose switch |

**Restart `next dev` after copying.** The `mongoose.models.X ||` pattern keeps old schemas until the server restarts, and strict mode silently drops new fields.

`queue-core.ts` imports only `./db` and `./models`, so the copy works as-is under `src/lib/`.

## 2. What frontdesk uses from `queue-core.ts`
| Need | Function |
|---|---|
| Bookable dates with slots left | `bookableDates(serviceId, now)` → days with `remaining > 0` (week-offs, holidays, full, unstaffed and closed days are filtered out) |
| One day's numbers | `capacityFor(serviceId, ymd, now)` → `{ reason, activeEmployees, capacity, cap, issued, live, remaining, queueStatus }` |
| Book | `reserveSlot(serviceId, ymd, now)` → `{ queueId, tokenNumber, info }` or `null` (full or closed) |
| ETA | `estimateServeAt(dept, service, ymd, active, peopleAhead, now)` and `peopleAhead(queueId, tokenNumber)` |
| Department "today" | `todayIn(timezone, now)`, `zonedTimeToDate(ymd, "HH:mm", timezone)` |

## 3. Booking contract (frontdesk `POST /api/v1/tokens`)
1. Look for the citizen's existing live token on that service and date. If there is one, return `ALREADY_BOOKED`.
2. `reserveSlot(serviceId, date, now)`. If it returns `null`, return `DATE_FULL`.
3. `peopleAhead(queueId, tokenNumber)`, then `estimateServeAt(...)`. Set **both** `estimatedServeAt` and `bookedServeAt` to it; `bookedServeAt` never changes afterwards.
4. Insert the `citizen_token`. If the insert fails (E11000 means a race on the live-token index), give the slot back with `ServiceQueue.updateOne({ _id: queueId }, { $inc: { issuedCount: -1 } })`. `lastTokenNumber` never goes back.

**Cancel:** `CitizenToken.findOneAndUpdate({ _id, citizenId, status: "WAITING" }, { status: "CANCELLED" })`, then `issuedCount −1` on the queue.

## 4. Rules both apps must agree on
- **Active staff:** only `role: "OFFICER"` employees count, not ADMINs. Frontdesk's API plan counted every assigned employee; `queue-core` replaces that.
- **ETA:** `floor(peopleAhead / officers) × avg`. This corrects the spec's `ceil`, because officers serve in parallel.
- **Today's capacity:** finished tokens + what still fits before the cutoff. The stored `capacity` is the whole day.
- **Token label:** `CODE-NNN`, padded to 3 digits (`DL-012`), as on the design's slip and board. Backoffice uses `formatTokenLabel` in `components/queue/token-label.tsx`.
- **Notifications:** frontdesk writes none. The backoffice notifier logs BOOKED, CANCELLED and ARRIVE_SOON (log only for now).
- **Counter:** once a token is called, `citizen_token.counterNumber` holds the officer's counter. Show it on the live status page and the board.

## 5. Review of frontdesk's working tree (2026-10-10, read-only)
The shared files are byte-identical and `src/lib/booking.ts` follows the booking and cancel contract. Still to fix in frontdesk:
- `booking.ts:184-185`: `peopleAhead` and `estimateServeAt` run after `reserveSlot` but outside the `try`. A database error there leaves `issuedCount` +1 with no token. Move both into the `try`.
- **Board:** it shows only `queue.nowServing`, which is the highest number called. With 2+ officers, a lower token being served at another counter never appears. Build the board from IN_SERVICE tokens (`label` + `counterNumber`).
- `contract-types.ts:66`: type `counterNumber` as `number | null`. The backoffice stores `null` when the officer has no counter.
- **Token slip QR** (`TokenSlip.tsx:81`): it encodes the token id. The console search matches a token number (`DL-012` works) or the last 4+ phone digits, so encode the label.
- `booking.ts:173-177`: a CLOSED queue, or a booking past the cutoff, returns DATE_FULL. Map these to "not bookable" instead.
- None of this work is committed yet.

## 6. Superseded in `front/_notes/frontdesk-plan.md`
Appendix A, "Backoffice dependencies" item 1 ("queue-core.ts gets written in frontdesk first, then copied to backoffice") is reversed: backoffice is the master. Item 3 (the backoffice cookie rename to `bo.session-token`) is done.
