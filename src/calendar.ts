/**
 * calendarport core: a 10-tool core subset of the Google Calendar
 * reference MCP server surface, implemented clean-room against the
 * public Google Calendar API documentation (base
 * https://www.googleapis.com/calendar/v3, overridable via
 * CALENDAR_API_URL).
 *
 * Auth: GOOGLE_ACCESS_TOKEN, sent as `Authorization: Bearer`.
 * A missing token is an error naming the variable. All HTTP goes
 * through an injected FetchFn so the wire behaviour is testable
 * offline. `calendar_id` defaults to "primary" on event tools.
 */
import type {
  CheckFreeBusyOptions,
  CreateCalendarOptions,
  CreateEventOptions,
  DeleteEventOptions,
  FetchFn,
  GetCalendarOptions,
  GetEventOptions,
  ListCalendarsOptions,
  ListEventsOptions,
  QuickAddEventOptions,
  UpdateEventOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_API_BASE = "https://www.googleapis.com/calendar/v3";

export function tokenFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.GOOGLE_ACCESS_TOKEN;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    throw new Error("GOOGLE_ACCESS_TOKEN environment variable is required");
  }
  return token;
}

export function baseFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.CALENDAR_API_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export const apiBaseFromEnv = baseFromEnv;

const enc = encodeURIComponent;

function cid(calendarId?: string): string {
  return enc(calendarId ?? "primary");
}

interface RequestSpec {
  method: string;
  url: string;
  body?: unknown;
}

async function apiRequest(
  fetchFn: FetchFn,
  token: string,
  spec: RequestSpec,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let body: string | undefined;
  if (spec.body !== undefined) {
    body = JSON.stringify(spec.body);
    headers["Content-Type"] = "application/json";
  }
  const res = await fetchFn(spec.url, { method: spec.method, headers, body });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const errObj = parsed.error as Record<string, unknown> | undefined;
      if (errObj && typeof errObj.message === "string") detail = errObj.message;
      else if (typeof parsed.message === "string") detail = parsed.message;
    } catch {
      // Keep the raw body as the detail.
    }
    throw new Error(`Google Calendar API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      parts.push(`${enc(key)}=${enc(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export async function listCalendars(
  fetchFn: FetchFn, token: string, base: string, _opts: ListCalendarsOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "GET",
    url: `${base}/users/me/calendarList`,
  });
}

export async function getCalendar(
  fetchFn: FetchFn, token: string, base: string, opts: GetCalendarOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "GET",
    url: `${base}/calendars/${enc(opts.calendar_id)}`,
  });
}

export async function createCalendar(
  fetchFn: FetchFn, token: string, base: string, opts: CreateCalendarOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "POST",
    url: `${base}/calendars`,
    body: { summary: opts.summary },
  });
}

export async function listEvents(
  fetchFn: FetchFn, token: string, base: string, opts: ListEventsOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "GET",
    url: `${base}/calendars/${cid(opts.calendar_id)}/events${query({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: opts.time_min,
      timeMax: opts.time_max,
      maxResults: opts.max_results,
      q: opts.query,
    })}`,
  });
}

export async function getEvent(
  fetchFn: FetchFn, token: string, base: string, opts: GetEventOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "GET",
    url: `${base}/calendars/${cid(opts.calendar_id)}/events/${enc(opts.event_id)}`,
  });
}

export async function createEvent(
  fetchFn: FetchFn, token: string, base: string, opts: CreateEventOptions,
): Promise<unknown> {
  const body: Record<string, unknown> = {
    summary: opts.summary,
    start: { dateTime: opts.start },
    end: { dateTime: opts.end },
  };
  if (opts.description !== undefined) body.description = opts.description;
  if (opts.location !== undefined) body.location = opts.location;
  if (opts.attendees) body.attendees = opts.attendees.map((email) => ({ email }));
  return apiRequest(fetchFn, token, {
    method: "POST",
    url: `${base}/calendars/${cid(opts.calendar_id)}/events`,
    body,
  });
}

export async function updateEvent(
  fetchFn: FetchFn, token: string, base: string, opts: UpdateEventOptions,
): Promise<unknown> {
  const body: Record<string, unknown> = {};
  if (opts.summary !== undefined) body.summary = opts.summary;
  if (opts.start !== undefined) body.start = { dateTime: opts.start };
  if (opts.end !== undefined) body.end = { dateTime: opts.end };
  if (opts.description !== undefined) body.description = opts.description;
  if (opts.location !== undefined) body.location = opts.location;
  return apiRequest(fetchFn, token, {
    method: "PATCH",
    url: `${base}/calendars/${cid(opts.calendar_id)}/events/${enc(opts.event_id)}`,
    body,
  });
}

export async function deleteEvent(
  fetchFn: FetchFn, token: string, base: string, opts: DeleteEventOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "DELETE",
    url: `${base}/calendars/${cid(opts.calendar_id)}/events/${enc(opts.event_id)}`,
  });
}

export async function quickAddEvent(
  fetchFn: FetchFn, token: string, base: string, opts: QuickAddEventOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "POST",
    url: `${base}/calendars/${cid(opts.calendar_id)}/events/quickAdd${query({ text: opts.text })}`,
  });
}

export async function checkFreeBusy(
  fetchFn: FetchFn, token: string, base: string, opts: CheckFreeBusyOptions,
): Promise<unknown> {
  return apiRequest(fetchFn, token, {
    method: "POST",
    url: `${base}/freeBusy`,
    body: {
      timeMin: opts.time_min,
      timeMax: opts.time_max,
      items: opts.calendar_ids.map((id) => ({ id })),
    },
  });
}

/** Dispatch a tool call by name. Used by both the MCP server and the CLI. */
export async function callTool(
  fetchFn: FetchFn,
  token: string,
  base: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "list_calendars":
      return listCalendars(fetchFn, token, base, args as unknown as ListCalendarsOptions);
    case "get_calendar":
      return getCalendar(fetchFn, token, base, args as unknown as GetCalendarOptions);
    case "create_calendar":
      return createCalendar(fetchFn, token, base, args as unknown as CreateCalendarOptions);
    case "list_events":
      return listEvents(fetchFn, token, base, args as unknown as ListEventsOptions);
    case "get_event":
      return getEvent(fetchFn, token, base, args as unknown as GetEventOptions);
    case "create_event":
      return createEvent(fetchFn, token, base, args as unknown as CreateEventOptions);
    case "update_event":
      return updateEvent(fetchFn, token, base, args as unknown as UpdateEventOptions);
    case "delete_event":
      return deleteEvent(fetchFn, token, base, args as unknown as DeleteEventOptions);
    case "quick_add_event":
      return quickAddEvent(fetchFn, token, base, args as unknown as QuickAddEventOptions);
    case "check_free_busy":
      return checkFreeBusy(fetchFn, token, base, args as unknown as CheckFreeBusyOptions);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
