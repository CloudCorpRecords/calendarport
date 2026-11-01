import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkFreeBusy,
  createCalendar,
  createEvent,
  deleteEvent,
  getCalendar,
  getEvent,
  listCalendars,
  listEvents,
  quickAddEvent,
  tokenFromEnv,
  updateEvent,
} from "../src/calendar.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(steps: Array<{ payload?: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const queue = [...steps];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
    const step = queue.shift() ?? { payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText ?? (step.payload === undefined ? "" : JSON.stringify(step.payload)),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN = "test-token";

describe("calendarport core", () => {
  it("names the env var when the token is missing", () => {
    assert.throws(() => tokenFromEnv({}), /GOOGLE_ACCESS_TOKEN environment variable is required/);
    assert.throws(() => tokenFromEnv({ GOOGLE_ACCESS_TOKEN: " " }), /GOOGLE_ACCESS_TOKEN/);
    assert.equal(tokenFromEnv({ GOOGLE_ACCESS_TOKEN: " x " }), "x");
  });

  it("list_calendars gets /users/me/calendarList with Bearer auth", async () => {
    const { fn, calls } = fakeFetch([{ payload: { items: [] } }]);
    await listCalendars(fn, TOKEN, BASE, {});
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].headers.Authorization, "Bearer test-token");
    assert.equal(calls[0].url, `${BASE}/users/me/calendarList`);
  });

  it("get_calendar gets /calendars/{id}", async () => {
    const { fn, calls } = fakeFetch([{ payload: { id: "cal1", summary: "Work" } }]);
    const out = (await getCalendar(fn, TOKEN, BASE, { calendar_id: "cal1" })) as Record<string, unknown>;
    assert.equal(out.summary, "Work");
    assert.equal(calls[0].url, `${BASE}/calendars/cal1`);
  });

  it("create_calendar posts {summary}", async () => {
    const { fn, calls } = fakeFetch([{ payload: { id: "newcal" } }]);
    await createCalendar(fn, TOKEN, BASE, { summary: "Team" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${BASE}/calendars`);
    assert.deepEqual(calls[0].body, { summary: "Team" });
  });

  it("list_events defaults to primary and shapes the query", async () => {
    const { fn, calls } = fakeFetch([{ payload: { items: [] } }]);
    await listEvents(fn, TOKEN, BASE, { time_min: "2026-10-27T00:00:00Z", time_max: "2026-10-28T00:00:00Z", max_results: 5, query: "standup" });
    assert.ok(calls[0].url.startsWith(`${BASE}/calendars/primary/events?`));
    assert.ok(calls[0].url.includes("singleEvents=true"));
    assert.ok(calls[0].url.includes("orderBy=startTime"));
    assert.ok(calls[0].url.includes("timeMin=2026-10-27T00%3A00%3A00Z"));
    assert.ok(calls[0].url.includes("timeMax=2026-10-28T00%3A00%3A00Z"));
    assert.ok(calls[0].url.includes("maxResults=5"));
    assert.ok(calls[0].url.includes("q=standup"));
  });

  it("list_events uses an explicit calendar_id", async () => {
    const { fn, calls } = fakeFetch([{ payload: { items: [] } }]);
    await listEvents(fn, TOKEN, BASE, { calendar_id: "work@example.com" });
    assert.ok(calls[0].url.startsWith(`${BASE}/calendars/work%40example.com/events?`));
  });

  it("get_event gets the event path with default calendar", async () => {
    const { fn, calls } = fakeFetch([{ payload: { id: "ev1" } }]);
    await getEvent(fn, TOKEN, BASE, { event_id: "ev1" });
    assert.equal(calls[0].url, `${BASE}/calendars/primary/events/ev1`);
  });

  it("create_event wraps start/end as dateTime and maps attendees", async () => {
    const { fn, calls } = fakeFetch([{ payload: { id: "ev2" } }]);
    await createEvent(fn, TOKEN, BASE, {
      summary: "Sync", start: "2026-10-27T15:00:00Z", end: "2026-10-27T16:00:00Z",
      description: "Weekly", location: "Office", attendees: ["a@example.com", "b@example.com"],
    });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${BASE}/calendars/primary/events`);
    assert.deepEqual(calls[0].body, {
      summary: "Sync",
      start: { dateTime: "2026-10-27T15:00:00Z" },
      end: { dateTime: "2026-10-27T16:00:00Z" },
      description: "Weekly",
      location: "Office",
      attendees: [{ email: "a@example.com" }, { email: "b@example.com" }],
    });
  });

  it("create_event omits optional fields that were not provided", async () => {
    const { fn, calls } = fakeFetch([{ payload: { id: "ev3" } }]);
    await createEvent(fn, TOKEN, BASE, { calendar_id: "c9", summary: "Solo", start: "2026-10-27T10:00:00Z", end: "2026-10-27T11:00:00Z" });
    assert.equal(calls[0].url, `${BASE}/calendars/c9/events`);
    assert.deepEqual(calls[0].body, {
      summary: "Solo",
      start: { dateTime: "2026-10-27T10:00:00Z" },
      end: { dateTime: "2026-10-27T11:00:00Z" },
    });
  });

  it("update_event patches only the provided fields", async () => {
    const { fn, calls } = fakeFetch([{ payload: { id: "ev1" } }, { payload: { id: "ev1" } }]);
    await updateEvent(fn, TOKEN, BASE, { event_id: "ev1", summary: "Renamed" });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, `${BASE}/calendars/primary/events/ev1`);
    assert.deepEqual(calls[0].body, { summary: "Renamed" });
    await updateEvent(fn, TOKEN, BASE, { event_id: "ev1", start: "2026-10-28T09:00:00Z", location: "Remote" });
    assert.deepEqual(calls[1].body, { start: { dateTime: "2026-10-28T09:00:00Z" }, location: "Remote" });
  });

  it("delete_event issues DELETE and maps an empty body to {status}", async () => {
    const { fn, calls } = fakeFetch([{ status: 204, rawText: "" }]);
    const out = (await deleteEvent(fn, TOKEN, BASE, { event_id: "ev9" })) as Record<string, unknown>;
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, `${BASE}/calendars/primary/events/ev9`);
    assert.deepEqual(out, { status: 204 });
  });

  it("quick_add_event posts to quickAdd with encoded text", async () => {
    const { fn, calls } = fakeFetch([{ payload: { id: "evq" } }]);
    await quickAddEvent(fn, TOKEN, BASE, { text: "Lunch with Sam tomorrow noon" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${BASE}/calendars/primary/events/quickAdd?text=Lunch%20with%20Sam%20tomorrow%20noon`);
  });

  it("check_free_busy posts timeMin/timeMax/items", async () => {
    const { fn, calls } = fakeFetch([{ payload: { calendars: {} } }]);
    await checkFreeBusy(fn, TOKEN, BASE, { time_min: "2026-10-27T00:00:00Z", time_max: "2026-10-27T23:59:59Z", calendar_ids: ["primary", "work@example.com"] });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${BASE}/freeBusy`);
    assert.deepEqual(calls[0].body, {
      timeMin: "2026-10-27T00:00:00Z",
      timeMax: "2026-10-27T23:59:59Z",
      items: [{ id: "primary" }, { id: "work@example.com" }],
    });
  });

  it("surfaces upstream error status and message", async () => {
    const { fn } = fakeFetch([{ payload: { error: { message: "Not Found" } }, status: 404 }]);
    await assert.rejects(
      () => getCalendar(fn, TOKEN, BASE, { calendar_id: "nope" }),
      /Google Calendar API error 404: Not Found/,
    );
  });
});
