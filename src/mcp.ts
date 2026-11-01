/**
 * calendarport MCP server. Core subset: 10 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { baseFromEnv, callTool, tokenFromEnv, VERSION } from "./calendar.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  list_calendars: z.object({}),
  get_calendar: z.object({ calendar_id: z.string() }),
  create_calendar: z.object({ summary: z.string() }),
  list_events: z.object({
    calendar_id: z.string().optional(), time_min: z.string().optional(),
    time_max: z.string().optional(), max_results: z.number().optional(),
    query: z.string().optional(),
  }),
  get_event: z.object({
    calendar_id: z.string().optional(), event_id: z.string(),
  }),
  create_event: z.object({
    calendar_id: z.string().optional(), summary: z.string(),
    start: z.string(), end: z.string(),
    description: z.string().optional(), location: z.string().optional(),
    attendees: z.array(z.string()).optional(),
  }),
  update_event: z.object({
    calendar_id: z.string().optional(), event_id: z.string(),
    summary: z.string().optional(), start: z.string().optional(),
    end: z.string().optional(), description: z.string().optional(),
    location: z.string().optional(),
  }),
  delete_event: z.object({
    calendar_id: z.string().optional(), event_id: z.string(),
  }),
  quick_add_event: z.object({
    calendar_id: z.string().optional(), text: z.string(),
  }),
  check_free_busy: z.object({
    time_min: z.string(), time_max: z.string(),
    calendar_ids: z.array(z.string()),
  }),
};

export const TOOLS = [
  {
    name: "list_calendars",
    description: "List the calendars in the user's Google Calendar calendar list.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_calendar",
    description: "Get a Google Calendar calendar by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { calendar_id: { type: "string", description: "The ID of the calendar to retrieve." } },
      required: ["calendar_id"],
    },
  },
  {
    name: "create_calendar",
    description: "Create a new Google Calendar calendar.",
    inputSchema: {
      type: "object" as const,
      properties: { summary: { type: "string", description: "The title (summary) of the new calendar." } },
      required: ["summary"],
    },
  },
  {
    name: "list_events",
    description: "List events on a Google Calendar calendar, optionally within a time range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendar_id: { type: "string", description: "The ID of the calendar to list events from. Defaults to \"primary\" if omitted." }, time_min: { type: "string", description: "The start of the time range to list events in, as an RFC 3339 timestamp." },
        time_max: { type: "string", description: "The end of the time range to list events in, as an RFC 3339 timestamp." }, max_results: { type: "number", description: "The maximum number of events to return." },
        query: { type: "string", description: "Free-text search query to filter events by." },
      },
      required: [],
    },
  },
  {
    name: "get_event",
    description: "Get a single event from a Google Calendar calendar.",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendar_id: { type: "string", description: "The ID of the calendar to get the event from. Defaults to \"primary\" if omitted." }, event_id: { type: "string", description: "The ID of the event to retrieve." },
      },
      required: ["event_id"],
    },
  },
  {
    name: "create_event",
    description: "Create a new event on a Google Calendar calendar.",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendar_id: { type: "string", description: "The ID of the calendar to create the event on. Defaults to \"primary\" if omitted." }, summary: { type: "string", description: "The title (summary) of the new event." },
        start: { type: "string", description: "The start time of the event, as an RFC 3339 date-time string." }, end: { type: "string", description: "The end time of the event, as an RFC 3339 date-time string." },
        description: { type: "string", description: "A description of the event." }, location: { type: "string", description: "The location of the event." },
        attendees: { type: "array", items: { type: "string" }, description: "The email addresses of the event attendees, each added as an attendee." },
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "update_event",
    description: "Update fields of an existing event on a Google Calendar calendar.",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendar_id: { type: "string", description: "The ID of the calendar to update the event on. Defaults to \"primary\" if omitted." }, event_id: { type: "string", description: "The ID of the event to update." },
        summary: { type: "string", description: "The new title (summary) of the event." }, start: { type: "string", description: "The new start time of the event, as an RFC 3339 date-time string." },
        end: { type: "string", description: "The new end time of the event, as an RFC 3339 date-time string." }, description: { type: "string", description: "The new description of the event." },
        location: { type: "string", description: "The new location of the event." },
      },
      required: ["event_id"],
    },
  },
  {
    name: "delete_event",
    description: "Delete an event from a Google Calendar calendar.",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendar_id: { type: "string", description: "The ID of the calendar to delete the event from. Defaults to \"primary\" if omitted." }, event_id: { type: "string", description: "The ID of the event to delete." },
      },
      required: ["event_id"],
    },
  },
  {
    name: "quick_add_event",
    description: "Create an event on a Google Calendar calendar from a free-text description.",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendar_id: { type: "string", description: "The ID of the calendar to create the event on. Defaults to \"primary\" if omitted." }, text: { type: "string", description: "The free-text description of the event to create, parsed by Google Calendar into an event." },
      },
      required: ["text"],
    },
  },
  {
    name: "check_free_busy",
    description: "Check free-busy availability for one or more calendars over a time range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        time_min: { type: "string", description: "The start of the time range to check, as an RFC 3339 timestamp." }, time_max: { type: "string", description: "The end of the time range to check, as an RFC 3339 timestamp." },
        calendar_ids: { type: "array", items: { type: "string" }, description: "The IDs of the calendars to check free-busy availability for." },
      },
      required: ["time_min", "time_max", "calendar_ids"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }],
  };
}
function errorResult(err: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: err instanceof Error ? err.message : String(err),
    }],
    isError: true,
  };
}

const server = new Server(
  { name: "calendarport", version: VERSION },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const token = tokenFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, token, baseFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
