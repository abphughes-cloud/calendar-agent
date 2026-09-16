"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentSuggestion } from "@/lib/planning";
import { acceptSuggestion, rejectSuggestion } from "@/app/agent/actions";
import { formatTime } from "@/lib/date";

function formatFullDateTime(suggestion: AgentSuggestion): string {
  if (!suggestion.start_time) return "";
  const start = new Date(suggestion.start_time);
  const dateLabel = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = suggestion.end_time
    ? `${formatTime(suggestion.start_time)} – ${formatTime(suggestion.end_time)}`
    : formatTime(suggestion.start_time);
  return `${dateLabel} · ${timeLabel}`;
}

function formatDuration(suggestion: AgentSuggestion): string | null {
  if (!suggestion.start_time || !suggestion.end_time) return null;
  const minutes = Math.round(
    (new Date(suggestion.end_time).getTime() -
      new Date(suggestion.start_time).getTime()) /
      60000
  );
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export default function SuggestionDetailModal({
  suggestion,
  conflict,
  onClose,
  onRemoved,
}: {
  suggestion: AgentSuggestion | null;
  conflict: boolean;
  onClose: () => void;
  onRemoved: (id: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!suggestion) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [suggestion, onClose]);

  if (!suggestion) return null;

  async function handleAccept() {
    if (!suggestion) return;
    setBusy(true);
    setError(null);
    try {
      await acceptSuggestion(suggestion);
      onRemoved(suggestion.id);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept suggestion.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!suggestion) return;
    setBusy(true);
    setError(null);
    try {
      await rejectSuggestion(suggestion.id);
      onRemoved(suggestion.id);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject suggestion.");
    } finally {
      setBusy(false);
    }
  }

  const duration = formatDuration(suggestion);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={suggestion.title}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
              conflict ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
            }`}
          >
            {conflict ? "Suggested · Conflict" : "Suggested"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          {suggestion.title}
        </h2>

        {suggestion.start_time && (
          <p className="mb-2 text-sm text-gray-600">
            {formatFullDateTime(suggestion)}
          </p>
        )}

        {suggestion.type && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Discipline: </span>
            {suggestion.type}
          </p>
        )}
        {suggestion.intensity && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Intensity: </span>
            {suggestion.intensity}
          </p>
        )}
        {duration && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Duration: </span>
            {duration}
          </p>
        )}
        {suggestion.distance && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Distance: </span>
            {suggestion.distance}
          </p>
        )}
        {suggestion.pace_or_effort && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Target pace/effort: </span>
            {suggestion.pace_or_effort}
          </p>
        )}
        {suggestion.location && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Location: </span>
            {suggestion.location}
          </p>
        )}
        {suggestion.plan_reference && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Training plan: </span>
            {suggestion.plan_reference}
          </p>
        )}

        {suggestion.structure && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              Session structure
            </p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {suggestion.structure}
            </p>
          </div>
        )}

        {suggestion.reason && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              Coaching rationale
            </p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {suggestion.reason}
            </p>
          </div>
        )}

        {suggestion.risk_warning && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {suggestion.risk_warning}
          </div>
        )}

        {conflict && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            This overlaps something already on your calendar. Review before
            accepting.
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleAccept}
            className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
