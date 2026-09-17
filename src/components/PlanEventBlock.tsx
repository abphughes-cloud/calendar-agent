import type { PlanEvent } from "@/lib/planning";
import { formatTime } from "@/lib/date";

const COMPACT_HEIGHT = 45;
const MINIMAL_HEIGHT = 30;

export default function PlanEventBlock({
  event,
  top,
  height,
  left,
  width,
  onSelect,
}: {
  event: PlanEvent;
  top: number;
  height: number;
  left: string;
  width: string;
  onSelect: (event: PlanEvent) => void;
}) {
  const time = `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`;
  const showLocation = height >= COMPACT_HEIGHT && Boolean(event.location);
  const showTime = height >= MINIMAL_HEIGHT;

  const tooltip = [
    event.title,
    time,
    event.location,
    event.type ? `Plan · ${event.type}` : "Plan",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      title={tooltip}
      onClick={() => onSelect(event)}
      className="absolute cursor-pointer overflow-hidden rounded-lg bg-blue-600 px-1.5 py-0.5 text-left text-white shadow-sm transition hover:bg-blue-700"
      style={{ top, height, left, width }}
    >
      <p
        className={`break-words text-xs font-semibold leading-tight ${
          height >= MINIMAL_HEIGHT ? "line-clamp-2" : "line-clamp-1"
        }`}
      >
        {event.title}
      </p>
      {showTime && (
        <p className="truncate text-xs leading-tight text-blue-100">{time}</p>
      )}
      {showLocation && (
        <p className="truncate text-xs leading-tight text-blue-200">
          {event.location}
        </p>
      )}
    </button>
  );
}
