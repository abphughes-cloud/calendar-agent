"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategorizedEvent } from "@/lib/category";
import type { AgentSuggestion, PlanEvent } from "@/lib/planning";
import type { HourlyWeather } from "@/lib/weather";
import { addDays } from "@/lib/week";
import { clearPendingSuggestions } from "@/app/agent/actions";
import WeekCalendar from "@/components/WeekCalendar";

export default function CalendarWithAgent({
  weekStart,
  events,
  planEvents,
  initialSuggestions,
  weather,
}: {
  weekStart: Date;
  events: CategorizedEvent[];
  planEvents: PlanEvent[];
  initialSuggestions: AgentSuggestion[];
  weather: HourlyWeather[];
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] =
    useState<AgentSuggestion[]>(initialSuggestions);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSuggest() {
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const res = await fetch("/api/agent/triathlon/suggest", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Could not generate suggestions.");
      }

      const newSuggestions: AgentSuggestion[] = Array.isArray(data.suggestions)
        ? data.suggestions
        : [];

      // The server already cleared old pending suggestions within
      // data.range before saving this batch. Mirror that here: replace
      // anything in that window rather than piling on top of it.
      const rangeStart = data.range ? new Date(data.range.start) : null;
      const rangeEnd = data.range ? new Date(data.range.end) : null;

      setSuggestions((prev) => {
        const outsideRange =
          rangeStart && rangeEnd
            ? prev.filter((s) => {
                if (!s.start_time) return true;
                const t = new Date(s.start_time).getTime();
                return t < rangeStart.getTime() || t >= rangeEnd.getTime();
              })
            : prev;
        return [...newSuggestions, ...outsideRange];
      });

      if (newSuggestions.length === 0 && data.message) {
        setInfoMessage(data.message);
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleClearSuggestions() {
    setClearing(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const weekEnd = addDays(weekStart, 7);
      await clearPendingSuggestions(
        weekStart.toISOString(),
        weekEnd.toISOString()
      );
      setSuggestions((prev) =>
        prev.filter((s) => {
          if (!s.start_time) return true;
          const t = new Date(s.start_time).getTime();
          return t < weekStart.getTime() || t >= weekEnd.getTime();
        })
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not clear suggestions."
      );
    } finally {
      setClearing(false);
    }
  }

  function removeSuggestion(id: string) {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSuggestionUpdated(updated: AgentSuggestion) {
    setErrorMessage(null);
    setSuggestions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  }

  function handlePlacementError(message: string) {
    setErrorMessage(message);
  }

  const showEmptyState =
    !loading && !clearing && !errorMessage && !infoMessage && suggestions.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={loading || clearing}
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Thinking…" : "Suggest next workouts"}
        </button>
        <button
          type="button"
          onClick={handleClearSuggestions}
          disabled={loading || clearing || suggestions.length === 0}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {clearing ? "Clearing…" : "Clear suggestions"}
        </button>
        {errorMessage && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {errorMessage}
          </p>
        )}
        {infoMessage && (
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
            {infoMessage}
          </p>
        )}
        {showEmptyState && (
          <p className="text-xs text-gray-400">
            No pending suggestions for this week.
          </p>
        )}
      </div>

      <WeekCalendar
        weekStart={weekStart}
        events={events}
        planEvents={planEvents}
        suggestions={suggestions}
        weather={weather}
        onSuggestionRemoved={removeSuggestion}
        onSuggestionUpdated={handleSuggestionUpdated}
        onPlacementError={handlePlacementError}
      />
    </div>
  );
}
