/**
 * calendarport types.
 *
 * A core subset of the Google Calendar reference MCP server surface:
 * calendars, events, quick add and free-busy against the Google
 * Calendar API. HTTP access is described by a minimal response
 * surface so tests can inject a fake fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface ListCalendarsOptions {
  [key: string]: never;
}

export interface GetCalendarOptions {
  calendar_id: string;
}

export interface CreateCalendarOptions {
  summary: string;
}

export interface ListEventsOptions {
  calendar_id?: string;
  time_min?: string;
  time_max?: string;
  max_results?: number;
  query?: string;
}

export interface GetEventOptions {
  calendar_id?: string;
  event_id: string;
}

export interface CreateEventOptions {
  calendar_id?: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}

export interface UpdateEventOptions {
  calendar_id?: string;
  event_id: string;
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
}

export interface DeleteEventOptions {
  calendar_id?: string;
  event_id: string;
}

export interface QuickAddEventOptions {
  calendar_id?: string;
  text: string;
}

export interface CheckFreeBusyOptions {
  time_min: string;
  time_max: string;
  calendar_ids: string[];
}
