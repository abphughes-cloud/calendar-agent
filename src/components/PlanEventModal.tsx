"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanEvent } from "@/lib/planning";
import { deletePlanEvent } from "@/app/plan/actions";
import { formatTime } from "@/lib/date";

function formatFullDateTime(event: PlanEvent): string {
  const start = new Date(event.start_time);
  const dateLabel = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${dateLabel} · ${formatTime(event.start_time)} – ${formatTime(
    event.end_time
  )}`;
}

export default function PlanEventModal({
  event,
  onClose,
}: {
  event: PlanEvent | null;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!event) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [event, onClose]);

  if (!event) return null;

  async function handleDelete() {
    if (!event) return;
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    await deletePlanEvent(event.id);
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-indigo-600">
            Plan · {event.type ?? "Other"}
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
          {event.title}
        </h2>

        <p className="mb-2 text-sm text-gray-600">
          {formatFullDateTime(event)}
        </p>

        {event.location && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Location: </span>
            {event.location}
          </p>
        )}

        <p className="mb-2 text-sm text-gray-600">
          <span className="font-medium text-gray-500">Status: </span>
          {event.status}
        </p>

        {event.intensity && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Intensity: </span>
            {event.intensity}
          </p>
        )}

        {event.notes && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {event.notes}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
          <Link
            href={`/plan/${event.id}/edit`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
