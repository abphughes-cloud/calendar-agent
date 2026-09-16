import type { AgentSuggestion } from "@/lib/planning";
import { formatTime } from "@/lib/date";

export default function SuggestionBlock({
  suggestion,
  top,
  height,
  left,
  width,
  conflict,
  busy,
  onAccept,
  onReject,
}: {
  suggestion: AgentSuggestion;
  top: number;
  height: number;
  left: string;
  width: string;
  conflict: boolean;
  busy: boolean;
  onAccept: (suggestion: AgentSuggestion) => void;
  onReject: (id: string) => void;
}) {
  const time =
    suggestion.start_time && suggestion.end_time
      ? `${formatTime(suggestion.start_time)} – ${formatTime(suggestion.end_time)}`
      : "";
  const meta = [suggestion.type, suggestion.intensity].filter(Boolean).join(" · ");

  return (
    <div
      title={[suggestion.title, time, meta, suggestion.reason]
        .filter(Boolean)
        .join("\n")}
      className={`absolute flex flex-col overflow-hidden rounded-lg border-2 border-dashed px-1.5 py-1 shadow-sm ${
        conflict
          ? "border-red-600 bg-red-50 text-red-900"
          : "border-blue-700 bg-blue-100 text-blue-900"
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
      <p className="line-clamp-2 break-words text-xs font-semibold leading-tight">
        {suggestion.title}
      </p>
      {time && <p className="truncate text-[11px] leading-tight opacity-80">{time}</p>}
      {meta && <p className="truncate text-[11px] leading-tight opacity-70">{meta}</p>}

      <div className="mt-auto flex gap-1 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAccept(suggestion)}
          className="rounded bg-blue-700 px-1.5 py-0.5 text-[10px] font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onReject(suggestion.id)}
          className="rounded border border-red-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
