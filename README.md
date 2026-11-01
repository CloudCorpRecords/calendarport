# calendarport

Google Calendar calendars and events as MCP tools, talking to the
Google Calendar API. calendarport is a clean-room rebuild of the core
surface of the Google Calendar reference MCP server, under a new name:
fresh code written from the public Calendar API documentation, no
copied branding.

## Tools (core subset, 10)

`list_calendars`, `get_calendar`, `create_calendar`, `list_events`,
`get_event`, `create_event`, `update_event`, `delete_event`,
`quick_add_event`, `check_free_busy`.

Calendar ACL and rules, event move/import/instances/watch, attachments,
conference data, settings and colors from the wider Calendar surface
are not in this subset. `calendar_id` is optional on event tools and
defaults to `primary`.

## Setup

Set a Google OAuth access token:

```bash
export GOOGLE_ACCESS_TOKEN=ya29....
```

Optionally override the API base with `CALENDAR_API_URL`
(default `https://www.googleapis.com/calendar/v3`). Without the token,
every tool call fails with an error naming the missing variable.

## CLI

```bash
npx @reneturcios/calendarport list_events '{"time_min":"2026-10-27T00:00:00Z"}'
npx @reneturcios/calendarport mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "calendarport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/calendarport", "mcp"],
      "env": { "GOOGLE_ACCESS_TOKEN": "ya29...." }
    }
  }
}
```

## Docker

```bash
docker run -i -e GOOGLE_ACCESS_TOKEN ghcr.io/cloudcorprecords/calendarport
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
