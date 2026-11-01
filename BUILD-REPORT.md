# calendarport — BUILD REPORT

Original: google-calendar (Google Calendar reference MCP server) →
Rebuild: calendarport
Tier C core subset. Local only, nothing pushed or published.

## Scope
10 tools against the Google Calendar API
(https://www.googleapis.com/calendar/v3, base overridable via
CALENDAR_API_URL), Authorization: Bearer GOOGLE_ACCESS_TOKEN, all
HTTP behind an injectable FetchFn: list_calendars, get_calendar,
create_calendar, list_events (singleEvents=true, orderBy=startTime),
get_event, create_event (start/end wrapped as {dateTime}, attendees
mapped to {email}), update_event (provided fields only), delete_event
(empty body mapped to {status}), quick_add_event, check_free_busy.
`calendar_id` defaults to "primary" on event tools.

Omitted groups (fixture `_source` lists them): ACL/rules, event
move/import/instances/watch, attachments, conferenceData, settings,
colors.

Ground truth: CORE-SUBSET, docs-derived from the public Google
Calendar API documentation. Fixture:
harness/fixtures/google-calendar-tools-original.json (labelled
core-subset; parity is vs the subset only).

## Verified (foreground, from disk)
- Tools: 10/10 — parity.json identical_tools = 10 = total.
- Unit tests: 14/14 pass (fake FetchFn; missing-token error, Bearer
  header, URL/method/body shaping for every tool, create_event
  dateTime wrapping + attendee mapping, update provided-fields-only,
  delete empty-body {status} mapping, upstream error surfacing).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env stdio check: tools/call list_calendars with
  GOOGLE_ACCESS_TOKEN unset returned isError
  "GOOGLE_ACCESS_TOKEN environment variable is required".
- server.json description 69 chars (≤100); OCI entry has no version
  field; Dockerfile label io.github.CloudCorpRecords/calendarport;
  full 19-file factory set present.

## Honest gaps
- No live Google Calendar call was made — request/response behaviour
  is fake-fetch proven only. No private Calendar data or connectors
  touched.
- create_event supports timed events only ({dateTime}); all-day
  {date} events and conferenceData are out of scope for this subset.
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
