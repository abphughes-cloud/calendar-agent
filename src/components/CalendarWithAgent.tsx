"use client";

import { useState } from "react";
import type { CategorizedEvent } from "@/lib/category";
import type { AgentSuggestion, PlanEvent } from "@/lib/planning";
import WeekCalendar from "@/components/WeekCalendar";

export default function CalendarWithAgent({
  weekStart,
  events,
  planEvents,
  initialSuggestions,
}: {
  weekStart: Date;
  events: CategorizedEvent[];
  planEvents: PlanEvent[];
  initialSuggestions: AgentSuggestion[];
}) {
  const [suggestions, setSuggestions] =
    useState<AgentSuggestion[]>(initialSuggestions);
  const [loading, setLoading] = useState(false);
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
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions((prev) => [...data.suggestions, ...prev]);
      } else if (data.message) {
        setInfoMessage(data.message);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function removeSuggestion(id: string) {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={loading}
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Thinking…" : "Suggest triathlon week"}
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
      </div>

      <WeekCalendar
        weekStart={weekStart}
        events={events}
        planEvents={planEvents}
        suggestions={suggestions}
        onSuggestionRemoved={removeSuggestion}
      />
    </div>
  );
}
