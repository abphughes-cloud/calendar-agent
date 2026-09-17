"use client";

import { useRef, useState } from "react";
import type { AgentSuggestion } from "@/lib/planning";
import { formatTime } from "@/lib/date";

const MINIMAL_HEIGHT = 30;
const RESIZE_SNAP_MINUTES = 15;
const DRAG_SNAP_MINUTES = 15;
// Pointer must move this many px before a press becomes a drag, so a plain
// click to open the detail modal still works.
const DRAG_THRESHOLD_PX = 4;

export default function SuggestionBlock({
  suggestion,
  top,
  height,
  left,
  width,
  conflict,
  pxPerMinute,
  onSelect,
  onResizeEnd,
  onDragEnd,
}: {
  suggestion: AgentSuggestion;
  top: number;
  height: number;
  left: string;
  width: string;
  conflict: boolean;
  pxPerMinute: number;
  onSelect: (suggestion: AgentSuggestion) => void;
  onResizeEnd: (suggestion: AgentSuggestion, newEnd: Date) => void;
  onDragEnd: (
    suggestion: AgentSuggestion,
    dayKey: string,
    minutesFromGridStart: number
  ) => void;
}) {
  const [resizePreviewHeight, setResizePreviewHeight] = useState<number | null>(
    null
  );
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const justDraggedRef = useRef(false);

  const time =
    suggestion.start_time && suggestion.end_time
      ? `${formatTime(suggestion.start_time)} – ${formatTime(suggestion.end_time)}`
      : "";
  const meta = [suggestion.type, suggestion.intensity].filter(Boolean).join(" · ");
  const renderedHeight = resizePreviewHeight ?? height;
  const showTime = renderedHeight >= MINIMAL_HEIGHT;

  const badgeLabel = conflict
    ? "Suggested · Conflict"
    : suggestion.is_edited
      ? "Suggested · Edited"
      : "Suggested";

  const tooltip = [
    suggestion.title,
    time,
    meta,
    suggestion.distance,
    badgeLabel,
    suggestion.reason,
  ]
    .filter(Boolean)
    .join("\n");

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!suggestion.start_time || !suggestion.end_time) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const trueDurationMin =
      (new Date(suggestion.end_time).getTime() -
        new Date(suggestion.start_time).getTime()) /
      60000;
    const startY = e.clientY;
    let previewMinutes = trueDurationMin;
    setResizePreviewHeight(trueDurationMin * pxPerMinute);

    function handleMove(ev: PointerEvent) {
      const deltaMin = (ev.clientY - startY) / pxPerMinute;
      const rawMinutes = trueDurationMin + deltaMin;
      const snapped = Math.max(
        RESIZE_SNAP_MINUTES,
        Math.round(rawMinutes / RESIZE_SNAP_MINUTES) * RESIZE_SNAP_MINUTES
      );
      previewMinutes = snapped;
      setResizePreviewHeight(snapped * pxPerMinute);
    }

    function handleUp() {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      setResizePreviewHeight(null);
      if (!suggestion.start_time) return;
      const newEnd = new Date(
        new Date(suggestion.start_time).getTime() + previewMinutes * 60000
      );
      onResizeEnd(suggestion, newEnd);
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }

  // Pointer-based tile drag. Mirrors the resize handler above rather than
  // native HTML5 drag-and-drop (draggable/dragstart/dragover/drop), which
  // is unreliable across browsers/input devices (e.g. requires dragenter
  // to also be prevented in some browsers, misbehaves with trackpads).
  function handleTilePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!suggestion.start_time || !suggestion.end_time) return;
    if (e.button !== 0) return;

    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let lastClientX = startX;
    let lastClientY = startY;

    function handleMove(ev: PointerEvent) {
      lastClientX = ev.clientX;
      lastClientY = ev.clientY;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        dragging = true;
        justDraggedRef.current = true;
        setIsDragging(true);
      }
      if (dragging) {
        setDragOffset({ x: dx, y: dy });
      }
    }

    function handleUp() {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
      setIsDragging(false);
      setDragOffset(null);

      if (!dragging || !suggestion.start_time) return;

      // pointer-events is disabled on this tile while dragging (below), so
      // elementFromPoint here finds whatever day column/tile is actually
      // under the cursor instead of hitting this tile's own DOM position.
      const dropTarget = document
        .elementFromPoint(lastClientX, lastClientY)
        ?.closest<HTMLElement>("[data-day-key]");
      if (!dropTarget?.dataset.dayKey) return;

      const rect = dropTarget.getBoundingClientRect();
      const rawMinutes = (lastClientY - rect.top) / pxPerMinute;
      const snapped = Math.round(rawMinutes / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
      onDragEnd(suggestion, dropTarget.dataset.dayKey, snapped);
    }

    target.setPointerCapture(pointerId);
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }

  return (
    <button
      type="button"
      title={tooltip}
      onPointerDown={handleTilePointerDown}
      onClick={() => {
        if (justDraggedRef.current) {
          justDraggedRef.current = false;
          return;
        }
        onSelect(suggestion);
      }}
      className={`absolute cursor-grab overflow-hidden rounded-lg border-2 border-dashed px-1.5 py-1 text-left shadow-sm transition active:cursor-grabbing ${
        conflict
          ? "border-red-600 bg-red-50 text-red-900 hover:bg-red-100"
          : "border-blue-700 bg-blue-100 text-blue-900 hover:bg-blue-200"
      } ${isDragging ? "opacity-80 shadow-lg" : ""}`}
      style={{
        top,
        height: renderedHeight,
        left,
        width,
        touchAction: "none",
        transform: dragOffset
          ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
          : undefined,
        pointerEvents: isDragging ? "none" : undefined,
        zIndex: isDragging ? 30 : undefined,
      }}
    >
      <p
        className={`text-[9px] font-bold uppercase leading-tight tracking-wide ${
          conflict ? "text-red-600" : "text-blue-700"
        }`}
      >
        {badgeLabel}
      </p>
      <p
        className={`break-words text-xs font-semibold leading-tight ${
          renderedHeight >= MINIMAL_HEIGHT ? "line-clamp-2" : "line-clamp-1"
        }`}
      >
        {suggestion.title}
      </p>
      {showTime && time && (
        <p className="truncate text-[11px] leading-tight opacity-80">{time}</p>
      )}
      {showTime && meta && (
        <p className="truncate text-[11px] leading-tight opacity-70">{meta}</p>
      )}
      {showTime && suggestion.distance && (
        <p className="truncate text-[11px] leading-tight opacity-70">
          {suggestion.distance}
        </p>
      )}

      <div
        role="presentation"
        onPointerDown={handleResizePointerDown}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize"
        style={{ touchAction: "none" }}
      />
    </button>
  );
}
