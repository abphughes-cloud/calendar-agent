import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CalendarApiError, fetchUpcomingEvents } from "@/lib/calendar";
import { createClient } from "@/utils/supabase/server";
import { computeFreeWindows, type BusyInterval } from "@/lib/freeWindows";
import { generateTriathlonSuggestions } from "@/lib/agent/triathlon";
import { addDays } from "@/lib/week";
import type { UserPreferences } from "@/lib/planning";

export async function POST() {
  const session = await auth();

  if (!session || session.error === "RefreshAccessTokenError" || !session.accessToken) {
    return NextResponse.json(
      { error: "You need to be signed in to Google to generate suggestions." },
      { status: 401 }
    );
  }

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = addDays(rangeStart, 7);

  // Google Calendar stays the source of truth for availability; a failure
  // here should stop the request rather than suggest into busy time.
  let googleBusy: BusyInterval[];
  try {
    const result = await fetchUpcomingEvents(session.accessToken, {
      timeMin: rangeStart,
      timeMax: rangeEnd,
    });
    googleBusy = result.events.map((e) => ({
      start: e.start,
      end: e.end,
      isAllDay: e.isAllDay,
    }));
  } catch (error) {
    const message =
      error instanceof CalendarApiError
        ? error.message
        : "Could not load your Google Calendar.";
    console.error("[Agent] Failed to load Google Calendar", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const supabase = await createClient();

  const [{ data: preferences, error: preferencesError }, { data: planEventsData, error: planEventsError }] =
    await Promise.all([
      supabase.from("user_preferences").select("*").limit(1).maybeSingle(),
      supabase
        .from("plan_events")
        .select("*")
        .gte("start_time", rangeStart.toISOString())
        .lt("start_time", rangeEnd.toISOString()),
    ]);

  if (preferencesError) {
    console.error("[Agent] Failed to load preferences", preferencesError);
  }
  if (planEventsError) {
    console.error("[Agent] Failed to load plan_events", planEventsError);
  }

  const planBusy: BusyInterval[] = (planEventsData ?? []).map((e) => ({
    start: e.start_time as string,
    end: e.end_time as string,
    isAllDay: false,
  }));

  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  const freeWindows = computeFreeWindows([...googleBusy, ...planBusy], days, now);

  if (freeWindows.length === 0) {
    return NextResponse.json({
      suggestions: [],
      message: "No free time found in the next 7 days to suggest training sessions.",
    });
  }

  let suggestions;
  try {
    suggestions = await generateTriathlonSuggestions({
      preferences: (preferences as UserPreferences | null) ?? null,
      freeWindows,
    });
  } catch (error) {
    console.error("[Agent] Failed to generate suggestions", error);
    return NextResponse.json(
      { error: "Could not generate suggestions right now. Please try again." },
      { status: 502 }
    );
  }

  const rows = suggestions.map((s) => ({ ...s, status: "pending" }));

  const { data: saved, error: saveError } = await supabase
    .from("agent_suggestions")
    .insert(rows)
    .select("*");

  if (saveError) {
    console.error("[Agent] Failed to save suggestions", saveError);
    return NextResponse.json(
      { error: "Generated suggestions but could not save them." },
      { status: 500 }
    );
  }

  return NextResponse.json({ suggestions: saved ?? [] });
}
