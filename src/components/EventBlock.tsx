import type { CategorizedEvent } from "@/lib/category";
import { formatTime } from "@/lib/date";

const COMPACT_HEIGHT = 45;
const MINIMAL_HEIGHT = 30;

function timeRangeLabel(event: CategorizedEvent): string {
  if (event.isAllDay) return "All day";
  if (!event.start) return "";
  return event.end
    ? `${formatTime(event.start)} – ${formatTime(event.end)}`
    : formatTime(event.start);
}

export default function EventBlock({
  event,
  top,
  height,
  left,
  width,
  onSelect,
}: {
  event: CategorizedEvent;
  top: number;
  height: number;
  left: string;
  width: string;
  onSelect: (event: CategorizedEvent) => void;
}) {
  const time = timeRangeLabel(event);
  const showLocation = height >= COMPACT_HEIGHT && Boolean(event.location);
  const showTime = height >= MINIMAL_HEIGHT;

  const tooltip = [event.title, time, event.location, event.category]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      title={tooltip}
      onClick={() => onSelect(event)}
      className={`absolute cursor-pointer overflow-hidden rounded-lg border-l-4 px-1.5 py-0.5 text-left shadow-sm transition hover:brightness-95 ${event.colorClass}`}
      style={{ top, height, left, width }}
    >
      <p
        className={`break-words text-xs font-semibold leading-tight ${
          height >= MINIMAL_HEIGHT ? "line-clamp-3" : "line-clamp-1"
        }`}
      >
        {event.title}
      </p>
      {showTime && time && (
        <p className="truncate text-xs leading-tight opacity-80">{time}</p>
      )}
      {showLocation && (
        <p className="line-clamp-2 break-words text-xs leading-tight opacity-70">
          {event.location}
        </p>
      )}
    </button>
  );
}
