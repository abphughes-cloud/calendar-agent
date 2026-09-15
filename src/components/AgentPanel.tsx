"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AgentSuggestion } from "@/lib/planning";
import { acceptSuggestion, rejectSuggestion } from "@/app/agent/actions";
import { formatTime } from "@/lib/date";

function formatSuggestionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AgentPanel({
  initialSuggestions,
}: {
  initialSuggestions: AgentSuggestion[];
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] =
    useState<AgentSuggestion[]>(initialSuggestions);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");

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

  async function handleConfirmReject(id: string) {
    setBusyId(id);
    setErrorMessage(null);
    try {
      await rejectSuggestion(id, rejectFeedback);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setRejectingId(null);
      setRejectFeedback("");
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
    <aside className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Training Agent
      </h2>

      <button
        type="button"
        onClick={handleSuggest}
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Thinking…" : "Suggest triathlon week"}
      </button>

      {errorMessage && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}
      {infoMessage && (
        <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
          {infoMessage}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {suggestions.length === 0 ? (
          <p className="text-xs text-gray-400">
            No suggestions yet. Click the button above to get a training plan
            for the next 7 days, based on your calendar and preferences.
          </p>
        ) : (
          suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-md border border-gray-200 p-3 text-sm"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-900">{s.title}</span>
                {s.type && (
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                    {s.type}
                  </span>
                )}
              </div>

              {s.start_time && s.end_time && (
                <p className="text-xs text-gray-500">
                  {formatSuggestionDate(s.start_time)} ·{" "}
                  {formatTime(s.start_time)} – {formatTime(s.end_time)}
                </p>
              )}
              {s.location && (
                <p className="text-xs text-gray-500">
                  Location: {s.location}
                </p>
              )}
              {s.intensity && (
                <p className="text-xs text-gray-500">
                  Intensity: {s.intensity}
                </p>
              )}
              {s.reason && (
                <p className="mt-1 text-xs text-gray-600">{s.reason}</p>
              )}

              {rejectingId === s.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={rejectFeedback}
                    onChange={(e) => setRejectFeedback(e.target.value)}
                    placeholder="Optional: why isn't this a good fit?"
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmReject(s.id)}
                      disabled={busyId === s.id}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectFeedback("");
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(s)}
                    disabled={busyId === s.id}
                    className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <Link
                    href={`/plan/new?fromSuggestion=${s.id}`}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRejectingId(s.id)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
