import type { CategorizedEvent } from "@/lib/category";
import type { AgentSuggestion, PlanEvent } from "@/lib/planning";

// Matches the buffer used when computing free windows (src/lib/freeWindows.ts).
const BUFFER_MINUTES = 30;
const GRID_START_HOUR = 6;
const GRID_END_HOUR = 23;

export interface PlacementCheck {
  ok: boolean;
  message?: string;
}

/**
 * Shared conflict check for dragging, resizing, or manually editing a
 * suggestion's time. Runs identically on the client (using already-loaded
 * calendar data, for instant feedback) and on the server (as the
 * authoritative backstop against plan_events/other suggestions).
 */
export function checkSuggestionPlacement({
  start,
  end,
  events,
  planEvents,
  suggestions,
  excludeSuggestionId,
}: {
  start: Date;
  end: Date;
  events: Pick<CategorizedEvent, "start" | "end" | "isAllDay">[];
  planEvents: Pick<PlanEvent, "start_time" | "end_time">[];
  suggestions: Pick<AgentSuggestion, "id" | "start_time" | "end_time">[];
  excludeSuggestionId?: string;
}): PlacementCheck {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: "Invalid start or end time." };
  }
  if (end.getTime() <= start.getTime()) {
    return { ok: false, message: "End time must be after start time." };
  }

  const startMinOfDay = start.getHours() * 60 + start.getMinutes();
  const endMinOfDay = end.getHours() * 60 + end.getMinutes();
  if (
    start.toDateString() !== end.toDateString() ||
    startMinOfDay < GRID_START_HOUR * 60 ||
    endMinOfDay > GRID_END_HOUR * 60
  ) {
    return {
      ok: false,
      message: `Please keep the session between ${GRID_START_HOUR}:00 and ${GRID_END_HOUR}:00 on the same day.`,
    };
  }

  const bufferedStart = new Date(start.getTime() - BUFFER_MINUTES * 60000);
  const bufferedEnd = new Date(end.getTime() + BUFFER_MINUTES * 60000);

  const overlapsGoogle = events.some((e) => {
    if (e.isAllDay || !e.start) return false;
    const eStart = new Date(e.start);
    const eEnd = new Date(e.end ?? e.start);
    return bufferedStart < eEnd && eStart < bufferedEnd;
  });

  const overlapsPlan = planEvents.some((p) => {
    const pStart = new Date(p.start_time);
    const pEnd = new Date(p.end_time);
    return bufferedStart < pEnd && pStart < bufferedEnd;
  });

  if (overlapsGoogle || overlapsPlan) {
    return {
      ok: false,
      message:
        "This move conflicts with another event or does not leave enough buffer.",
    };
  }

  const overlapsSuggestion = suggestions.some((s) => {
    if (s.id === excludeSuggestionId) return false;
    if (!s.start_time || !s.end_time) return false;
    const sStart = new Date(s.start_time);
    const sEnd = new Date(s.end_time);
    return start < sEnd && sStart < end;
  });
  if (overlapsSuggestion) {
    return { ok: false, message: "This move conflicts with another suggestion." };
  }

  return { ok: true };
}

const DURATION_BOUNDS_MIN: Record<string, { min: number; max: number }> = {
  Swim: { min: 30, max: 60 },
  Run: { min: 20, max: 90 },
  Strength: { min: 25, max: 75 },
};

const SHORT_BIKE_KEYWORDS = [
  "recovery",
  "turbo",
  "indoor",
  "commute",
  "taper",
  "easy spin",
];

/**
 * Checks a candidate duration against the per-discipline realism rules
 * from the athlete training context (mirrors the bounds used when
 * generating suggestions in src/lib/agent/triathlon.ts). contextText
 * should be a concatenation of any free-text fields (structure, reason,
 * plan_reference) so a short bike ride explicitly marked recovery/turbo/
 * commute/taper is still allowed.
 */
export function checkSuggestionDuration(
  type: string | null,
  minutes: number,
  contextText: string
): PlacementCheck {
  if (minutes <= 0) {
    return { ok: false, message: "Duration must be greater than zero." };
  }
  if (!type) return { ok: true };

  if (type === "Bike") {
    if (minutes >= 90) return { ok: true };
    const text = contextText.toLowerCase();
    const allowedShort = SHORT_BIKE_KEYWORDS.some((kw) => text.includes(kw));
    if (!allowedShort) {
      return {
        ok: false,
        message:
          "Outdoor bike sessions under 90 minutes should be marked recovery/turbo/commute/taper, or lengthened.",
      };
    }
    return { ok: true };
  }

  const bounds = DURATION_BOUNDS_MIN[type];
  if (!bounds) return { ok: true };
  if (minutes < bounds.min || minutes > bounds.max) {
    return {
      ok: false,
      message: `${type} sessions are usually ${bounds.min}-${bounds.max} minutes.`,
    };
  }
  return { ok: true };
}
