import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { CalendarApiError, fetchUpcomingEvents } from "@/lib/calendar";
import { withCategory } from "@/lib/category";
import { addDays, parseDateKey, startOfWeek } from "@/lib/week";
import type { AgentSuggestion, PlanEvent } from "@/lib/planning";
import { fetchWeekWeather, type HourlyWeather } from "@/lib/weather";
import { createClient } from "@/utils/supabase/server";
import CalendarWithAgent from "@/components/CalendarWithAgent";
import CalendarDebugPanel from "@/components/CalendarDebugPanel";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth();

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Calendar Planner
          </h1>
          <p className="text-gray-500">
            Sign in with Google to see your week as a calendar grid.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="w-full rounded-md bg-blue-800 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
            >
              Sign in with Google
            </button>
          </form>
        </div>
      </main>
    );
  }

  const sessionExpired = session.error === "RefreshAccessTokenError";
  const isDev = process.env.NODE_ENV !== "production";

  const params = await searchParams;
  const weekParam = Array.isArray(params.week) ? params.week[0] : params.week;
  const weekStart = parseDateKey(weekParam) ?? startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 7);

  let result: Awaited<ReturnType<typeof fetchUpcomingEvents>> | null = null;
  let errorMessage: string | null = sessionExpired
    ? "Your Google session has expired. Please sign out and sign in again."
    : null;
  let errorDetails: string | null = null;

  if (!sessionExpired && session.accessToken) {
    try {
      result = await fetchUpcomingEvents(session.accessToken, {
        timeMin: weekStart,
        timeMax: weekEnd,
      });
    } catch (error) {
      if (error instanceof CalendarApiError) {
        errorMessage = error.message;
        if (isDev) {
          errorDetails = [
            error.status ? `status: ${error.status}` : null,
            error.details,
          ]
            .filter(Boolean)
            .join(" — ");
        }
      } else {
        errorMessage = "Something went wrong loading your calendar.";
        if (isDev && error instanceof Error) {
          errorDetails = error.message;
        }
      }
    }
  } else if (!sessionExpired) {
    errorMessage = "No access token was found. Please sign out and sign in again.";
  }

  const events = (result?.events ?? []).map(withCategory);

  // Supabase planning-layer overlay. Independent of the Google fetch above:
  // if this fails, the Google Calendar view must still render normally.
  let planEvents: PlanEvent[] = [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plan_events")
      .select("*")
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString())
      .order("start_time", { ascending: true });

    if (error) throw error;
    planEvents = data ?? [];
  } catch (error) {
    console.error("[Supabase] Failed to load plan_events", error);
  }

  // Pending suggestions from the training agent, independent of the fetches
  // above for the same reason: a failure here must not break the calendar.
  let suggestions: AgentSuggestion[] = [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("agent_suggestions")
      .select("*")
      .eq("status", "pending")
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString())
      .order("start_time", { ascending: true });

    if (error) throw error;
    suggestions = data ?? [];
  } catch (error) {
    console.error("[Supabase] Failed to load agent_suggestions", error);
  }

  // Live weather overlay, independent of the fetches above for the same
  // reason: a failed forecast must never break the calendar.
  let weather: HourlyWeather[] = [];
  try {
    weather = await fetchWeekWeather({ weekStart, weekEnd });
  } catch (error) {
    console.error("[Weather] Failed to load forecast", error);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Calendar Planner
          </h1>
          {session.user?.email && (
            <p className="text-sm text-gray-500">
              Signed in as {session.user.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/preferences"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Preferences
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{errorMessage}</p>
          {errorDetails && (
            <p className="mt-2 break-all font-mono text-xs text-red-500">
              {errorDetails}
            </p>
          )}
        </div>
      ) : (
        <CalendarWithAgent
          weekStart={weekStart}
          events={events}
          planEvents={planEvents}
          initialSuggestions={suggestions}
          weather={weather}
        />
      )}

      {result && (
        <CalendarDebugPanel
          calendars={result.calendars}
          perCalendarCounts={result.perCalendarCounts}
        />
      )}
    </main>
  );
}
