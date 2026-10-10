// Response shapes of the frontdesk API (/api/v1).
// Dates are "YYYY-MM-DD", times "HH:mm" (office time zone); exact moments are ISO strings.

export type TokenState = "WAITING" | "ARRIVED" | "IN_SERVICE" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
export type QueueState = "OPEN" | "PAUSED" | "CLOSED";

export interface OfficeDTO {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  workingHours: { start: string; end: string };
  weekOffDays: number[];
  timezone: string;
  isOpenToday: boolean; // not a week-off or holiday today, in the office's time zone
}

export interface ServiceDTO {
  id: string;
  departmentId: string;
  departmentName: string;
  city?: string;
  name: string;
  code: string;
  description?: string;
  avgServiceMinutes: number;
  cutoffTime: string;
  bookingWindowDays: number;
}

export interface AvailabilityDTO {
  serviceId: string;
  timezone: string;
  windowStart: string; // first and last day a citizen may book
  windowEnd: string;
  dates: { date: string; slotsLeft: number; expectedServeAt: string }[]; // bookable days only
}

export interface TokenDTO {
  id: string;
  label: string; // e.g. "DL-012"
  tokenNumber: number;
  status: TokenState;
  date: string;
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  departmentId: string;
  departmentName: string;
  timezone: string;
  estimatedServeAt: string;
  bookedServeAt: string;
  createdAt: string;
}

export interface TokenStatusDTO {
  token: TokenDTO;
  office: OfficeDTO;
  queueStatus: QueueState;
  nowServing: number;
  peopleAhead: number;
  position: number;
  liveEtaAt: string;
  waitMin: number;
  counterNumber?: number; // set by backoffice when the token is called
}

export interface BoardDTO {
  departmentId: string;
  departmentName: string;
  city?: string;
  date: string;
  timezone: string;
  isOpenNow: boolean; // a working day and before closing time
  opensNext: { date: string; time: string } | null; // when closed: next opening
  services: {
    serviceId: string;
    name: string;
    code: string;
    queueStatus: QueueState | null; // null: no token booked for today yet
    nowServing: number;
    waiting: number; // WAITING + ARRIVED
    upNext: number[]; // next few token numbers in line
    completed: number;
    availableToday: number; // tokens still bookable today
  }[];
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; [extra: string]: unknown } };
