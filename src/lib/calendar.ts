const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const DAYS_AHEAD = 14;
const ALLOWED_ROLES = new Set(["reader", "writer", "owner", "freeBusyReader"]);

export interface CalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  isAllDay: boolean;
  location?: string;
  description?: string;
  calendarId: string;
  calendarSummary: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  selected?: boolean;
  hidden?: boolean;
  accessRole?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  included: boolean;
}

export interface CalendarFetchResult {
  events: CalendarEvent[];
  calendars: CalendarListEntry[];
  perCalendarCounts: { calendarId: string; name: string; count: number; error?: string }[];
}

export class CalendarApiError extends Error {
  status?: number;
  details?: string;

  constructor(message: string, status?: number, details?: string) {
    super(message);
    this.name = "CalendarApiError";
    this.status = status;
    this.details = details;
  }
}

class GoogleApiRequestError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Google API request failed with status ${status}`);
    this.name = "GoogleApiRequestError";
    this.status = status;
    this.body = body;
  }
}

interface GoogleCalendarListEntry {
  id?: string;
  summary?: string;
  summaryOverride?: string;
  selected?: boolean;
  hidden?: boolean;
  accessRole?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
}

interface GoogleEventItem {
  id?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

async function googleCalendarGet<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(`${CALENDAR_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new GoogleApiRequestError(res.status, body);
  }

  return body as T;
}

function describeError(error: unknown): string {
  if (error instanceof GoogleApiRequestError) {
    return `status ${error.status} — ${JSON.stringify(error.body)}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function isCalendarIncluded(entry: GoogleCalendarListEntry): boolean {
  const selectedOk =
    entry.selected === undefined ? true : entry.selected === true;
  const notHidden = entry.hidden !== true;
  const roleOk = Boolean(entry.accessRole && ALLOWED_ROLES.has(entry.accessRole));
  return selectedOk && notHidden && roleOk;
}

async function fetchFullCalendarList(
  accessToken: string
): Promise<GoogleCalendarListEntry[]> {
  const all: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await googleCalendarGet<{
      items?: GoogleCalendarListEntry[];
      nextPageToken?: string;
    }>(`/users/me/calendarList?${params.toString()}`, accessToken);

    all.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

export async function fetchUpcomingEvents(
  accessToken: string,
  range?: { timeMin: Date; timeMax: Date }
): Promise<CalendarFetchResult> {
  const timeMin = range?.timeMin ?? new Date();
  const timeMax =
    range?.timeMax ??
    new Date(timeMin.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

  try {
    const rawCalendars = await fetchFullCalendarList(accessToken);
    const relevant = rawCalendars.filter(
      (entry): entry is GoogleCalendarListEntry & { id: string } =>
        Boolean(entry.id) && isCalendarIncluded(entry)
    );

    console.log(
      `[Google Calendar] Found ${rawCalendars.length} calendars in calendarList, ${relevant.length} relevant after filtering:`,
      relevant.map((c) => c.summaryOverride || c.summary || c.id).join(", ")
    );

    const perCalendar = await Promise.all(
      relevant.map(async (cal) => {
        const calendarId = cal.id;
        const name = cal.summaryOverride || cal.summary || calendarId;

        try {
          const params = new URLSearchParams({
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "250",
          });

          const data = await googleCalendarGet<{ items?: GoogleEventItem[] }>(
            `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
            accessToken
          );

          const items = data.items ?? [];
          console.log(
            `[Google Calendar] "${name}" (${calendarId}): ${items.length} events`
          );

          const events: CalendarEvent[] = items
            .filter((item) => item.id)
            .map((item) => ({
              id: `${calendarId}:${item.id}`,
              title: item.summary ?? "(No title)",
              start: item.start?.dateTime ?? item.start?.date ?? null,
              end: item.end?.dateTime ?? item.end?.date ?? null,
              isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
              location: item.location ?? undefined,
              description: item.description ?? undefined,
              calendarId,
              calendarSummary: name,
              backgroundColor: cal.backgroundColor ?? undefined,
              foregroundColor: cal.foregroundColor ?? undefined,
            }));

          return { calendarId, name, count: events.length, events };
        } catch (error) {
          const details = describeError(error);
          console.error(
            `[Google Calendar] Failed to fetch events for "${name}" (${calendarId}): ${details}`
          );
          return {
            calendarId,
            name,
            count: 0,
            events: [] as CalendarEvent[],
            error: details,
          };
        }
      })
    );

    const allEvents = perCalendar
      .flatMap((r) => r.events)
      .sort((a, b) => {
        const aTime = a.start ? new Date(a.start).getTime() : 0;
        const bTime = b.start ? new Date(b.start).getTime() : 0;
        return aTime - bTime;
      });

    const calendars: CalendarListEntry[] = rawCalendars
      .filter((entry): entry is GoogleCalendarListEntry & { id: string } =>
        Boolean(entry.id)
      )
      .map((entry) => ({
        id: entry.id,
        summary: entry.summaryOverride || entry.summary || entry.id,
        selected: entry.selected,
        hidden: entry.hidden,
        accessRole: entry.accessRole,
        primary: entry.primary,
        backgroundColor: entry.backgroundColor,
        foregroundColor: entry.foregroundColor,
        included: isCalendarIncluded(entry),
      }));

    return {
      events: allEvents,
      calendars,
      perCalendarCounts: perCalendar.map(
        ({ calendarId, name, count, error }) => ({
          calendarId,
          name,
          count,
          error,
        })
      ),
    };
  } catch (error) {
    const status =
      error instanceof GoogleApiRequestError ? error.status : undefined;
    const details =
      error instanceof GoogleApiRequestError
        ? JSON.stringify(error.body)
        : error instanceof Error
          ? error.message
          : String(error);

    console.error("[Google Calendar API] request failed", { status, details });

    throw new CalendarApiError(
      status === 401
        ? "Your Google session has expired. Please sign out and sign in again."
        : status === 403
          ? "Google denied access to your calendar. The readonly Calendar scope may not have been granted — try signing out, revoking access, and signing in again."
          : "Could not load your calendar events from Google right now.",
      status,
      details
    );
  }
}
