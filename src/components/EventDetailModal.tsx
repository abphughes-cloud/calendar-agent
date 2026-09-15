"use client";

import { useEffect } from "react";
import type { CategorizedEvent } from "@/lib/category";
import { categoryStyle } from "@/lib/category";
import { formatTime } from "@/lib/date";

function formatFullDateTime(event: CategorizedEvent): string {
  if (!event.start) return "";

  if (event.isAllDay) {
    const d = new Date(`${event.start}T00:00:00`);
    const dateLabel = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return `${dateLabel} · All day`;
  }

  const start = new Date(event.start);
  const dateLabel = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = event.end
    ? `${formatTime(event.start)} – ${formatTime(event.end)}`
    : formatTime(event.start);
  return `${dateLabel} · ${timeLabel}`;
}

export default function EventDetailModal({
  event,
  onClose,
}: {
  event: CategorizedEvent | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!event) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [event, onClose]);

  if (!event) return null;

  const style = categoryStyle(event.category);

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
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${style.dotClass}`}
            />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {event.category}
            </span>
          </div>
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

        <p className="mb-2 text-sm text-gray-600">{formatFullDateTime(event)}</p>

        {event.location && (
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Location: </span>
            {event.location}
          </p>
        )}

        {event.description && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {event.description}
            </p>
          </div>
        )}

        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
          Calendar: {event.calendarSummary}
        </div>
      </div>
    </div>
  );
}
