import type { ApiResponse } from "./contract-types";

const BASE_URL = "/api/v1";

// Error from an { ok: false } response; `code` drives UI messages (DATE_FULL, ALREADY_BOOKED, ...)
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!json) throw new ApiError("INTERNAL", "The server sent an unexpected response", res.status);
  if (!json.ok) {
    const { code, message, ...details } = json.error;
    throw new ApiError(code, message, res.status, details);
  }
  return json.data;
}
