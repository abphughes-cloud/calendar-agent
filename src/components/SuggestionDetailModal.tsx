"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategorizedEvent } from "@/lib/category";
import {
  SUGGESTION_TYPES,
  PLAN_EVENT_INTENSITIES,
  type AgentSuggestion,
  type PlanEvent,
} from "@/lib/planning";
import {
  acceptSuggestion,
  rejectSuggestion,
  updateSuggestion,
} from "@/app/agent/actions";
import {
  checkSuggestionDuration,
  checkSuggestionPlacement,
} from "@/lib/agent/suggestionPlacement";
import { formatTime } from "@/lib/date";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-gray-500";

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

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

interface EditDraft {
  title: string;
  type: string;
  startLocal: string;
  endLocal: string;
  location: string;
  intensity: string;
  distance: string;
  structure: string;
  pace_or_effort: string;
  plan_reference: string;
  reason: string;
  risk_warning: string;
}

function draftFromSuggestion(suggestion: AgentSuggestion): EditDraft {
  return {
    title: suggestion.title,
    type: suggestion.type ?? SUGGESTION_TYPES[0],
    startLocal: suggestion.start_time ? toLocalInputValue(suggestion.start_time) : "",
    endLocal: suggestion.end_time ? toLocalInputValue(suggestion.end_time) : "",
    location: suggestion.location ?? "",
    intensity: suggestion.intensity ?? PLAN_EVENT_INTENSITIES[1],
    distance: suggestion.distance ?? "",
    structure: suggestion.structure ?? "",
    pace_or_effort: suggestion.pace_or_effort ?? "",
    plan_reference: suggestion.plan_reference ?? "",
    reason: suggestion.reason ?? "",
    risk_warning: suggestion.risk_warning ?? "",
  };
}

export default function SuggestionDetailModal({
  suggestion,
  conflict,
  events,
  planEvents,
  suggestions,
  onClose,
  onRemoved,
  onUpdated,
}: {
  suggestion: AgentSuggestion | null;
  conflict: boolean;
  events: CategorizedEvent[];
  planEvents: PlanEvent[];
  suggestions: AgentSuggestion[];
  onClose: () => void;
  onRemoved: (id: string) => void;
  onUpdated: (updated: AgentSuggestion) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

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

  function startEditing() {
    if (!suggestion) return;
    setError(null);
    setDraft(draftFromSuggestion(suggestion));
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!suggestion || !draft) return;
    setBusy(true);
    setError(null);

    if (!draft.title.trim()) {
      setError("Title is required.");
      setBusy(false);
      return;
    }
    if (!draft.startLocal || !draft.endLocal) {
      setError("Start and end time are required.");
      setBusy(false);
      return;
    }

    const newStart = new Date(draft.startLocal);
    const newEnd = new Date(draft.endLocal);

    const placement = checkSuggestionPlacement({
      start: newStart,
      end: newEnd,
      events,
      planEvents,
      suggestions,
      excludeSuggestionId: suggestion.id,
    });
    if (!placement.ok) {
      setError(placement.message ?? "This time doesn't work.");
      setBusy(false);
      return;
    }

    const minutes = (newEnd.getTime() - newStart.getTime()) / 60000;
    const contextText = [draft.structure, draft.reason, draft.plan_reference]
      .filter(Boolean)
      .join(" ");
    const durationCheck = checkSuggestionDuration(draft.type, minutes, contextText);
    if (!durationCheck.ok) {
      setError(durationCheck.message ?? "That duration isn't realistic for this discipline.");
      setBusy(false);
      return;
    }

    try {
      const updated = await updateSuggestion(suggestion.id, {
        title: draft.title.trim(),
        type: draft.type,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        location: draft.location.trim() || null,
        intensity: draft.intensity,
        distance: draft.distance.trim() || null,
        structure: draft.structure.trim(),
        pace_or_effort: draft.pace_or_effort.trim() || null,
        plan_reference: draft.plan_reference.trim(),
        reason: draft.reason.trim(),
        risk_warning: draft.risk_warning.trim() || null,
      });
      onUpdated(updated);
      setEditing(false);
      setDraft(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  const duration = formatDuration(suggestion);
  const badgeLabel = conflict
    ? "Suggested · Conflict"
    : suggestion.is_edited
      ? "Suggested · Edited"
      : "Suggested";

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
            {badgeLabel}
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

        {editing && draft ? (
          <div className="space-y-3">
            <label className="block">
              <span className={LABEL_CLASS}>Title</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={LABEL_CLASS}>Discipline</span>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {SUGGESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Intensity</span>
                <select
                  value={draft.intensity}
                  onChange={(e) => setDraft({ ...draft, intensity: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {PLAN_EVENT_INTENSITIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={LABEL_CLASS}>Start</span>
                <input
                  type="datetime-local"
                  value={draft.startLocal}
                  onChange={(e) => setDraft({ ...draft, startLocal: e.target.value })}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>End</span>
                <input
                  type="datetime-local"
                  value={draft.endLocal}
                  onChange={(e) => setDraft({ ...draft, endLocal: e.target.value })}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={LABEL_CLASS}>Distance</span>
                <input
                  value={draft.distance}
                  onChange={(e) => setDraft({ ...draft, distance: e.target.value })}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Target pace/effort</span>
                <input
                  value={draft.pace_or_effort}
                  onChange={(e) => setDraft({ ...draft, pace_or_effort: e.target.value })}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <label className="block">
              <span className={LABEL_CLASS}>Location</span>
              <input
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Training plan mapping</span>
              <input
                value={draft.plan_reference}
                onChange={(e) => setDraft({ ...draft, plan_reference: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Session structure</span>
              <textarea
                rows={2}
                value={draft.structure}
                onChange={(e) => setDraft({ ...draft, structure: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Rationale / notes</span>
              <textarea
                rows={2}
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Risk warning</span>
              <textarea
                rows={2}
                value={draft.risk_warning}
                onChange={(e) => setDraft({ ...draft, risk_warning: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveEdit}
                className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                  setError(null);
                }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
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

            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
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
                onClick={startEditing}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit
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
          </>
        )}
      </div>
    </div>
  );
}
