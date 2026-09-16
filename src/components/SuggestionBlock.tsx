import type { AgentSuggestion } from "@/lib/planning";
import { formatTime } from "@/lib/date";

const MINIMAL_HEIGHT = 30;

export default function SuggestionBlock({
  suggestion,
  top,
  height,
  left,
  width,
  conflict,
  onSelect,
}: {
  suggestion: AgentSuggestion;
  top: number;
  height: number;
  left: string;
  width: string;
  conflict: boolean;
  onSelect: (suggestion: AgentSuggestion) => void;
}) {
  const time =
    suggestion.start_time && suggestion.end_time
      ? `${formatTime(suggestion.start_time)} – ${formatTime(suggestion.end_time)}`
      : "";
  const meta = [suggestion.type, suggestion.intensity].filter(Boolean).join(" · ");
  const showTime = height >= MINIMAL_HEIGHT;

  const tooltip = [
    suggestion.title,
    time,
    meta,
    conflict ? "Conflict" : "Suggested",
    suggestion.reason,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      title={tooltip}
      onClick={() => onSelect(suggestion)}
      className={`absolute cursor-pointer overflow-hidden rounded-lg border-2 border-dashed px-1.5 py-1 text-left shadow-sm transition ${
        conflict
          ? "border-red-600 bg-red-50 text-red-900 hover:bg-red-100"
          : "border-blue-700 bg-blue-100 text-blue-900 hover:bg-blue-200"
      }`}
      style={{ top, height, left, width }}
    >
      <p
        className={`text-[9px] font-bold uppercase leading-tight tracking-wide ${
          conflict ? "text-red-600" : "text-blue-700"
        }`}
      >
        {conflict ? "Suggested · Conflict" : "Suggested"}
      </p>
      <p
        className={`break-words text-xs font-semibold leading-tight ${
          height >= MINIMAL_HEIGHT ? "line-clamp-2" : "line-clamp-1"
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
    </button>
  );
}
