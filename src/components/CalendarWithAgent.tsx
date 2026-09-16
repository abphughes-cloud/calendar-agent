"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategorizedEvent } from "@/lib/category";
import type { AgentSuggestion, PlanEvent } from "@/lib/planning";
import { acceptSuggestion, rejectSuggestion } from "@/app/agent/actions";
import WeekCalendar from "@/components/WeekCalendar";
import AgentPanel from "@/components/AgentPanel";

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
  const router = useRouter();
  const [suggestions, setSuggestions] =
    useState<AgentSuggestion[]>(initialSuggestions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSuggestionsAdded(newOnes: AgentSuggestion[]) {
    setSuggestions((prev) => [...newOnes, ...prev]);
  }

  async function handleAccept(suggestion: AgentSuggestion) {
    setBusyId(suggestion.id);
    setErrorMessage(null);
    try {
      await acceptSuggestion(suggestion);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not accept suggestion."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string, feedbackText?: string) {
    setBusyId(id);
    setErrorMessage(null);
    try {
      await rejectSuggestion(id, feedbackText);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not reject suggestion."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <WeekCalendar
          weekStart={weekStart}
          events={events}
          planEvents={planEvents}
          suggestions={suggestions}
          busySuggestionId={busyId}
          onAcceptSuggestion={handleAccept}
          onRejectSuggestion={(id) => handleReject(id)}
        />
      </div>
      <div className="lg:w-80 lg:flex-shrink-0">
        <AgentPanel
          suggestions={suggestions}
          onSuggestionsAdded={handleSuggestionsAdded}
          busyId={busyId}
          errorMessage={errorMessage}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </div>
    </div>
  );
}
