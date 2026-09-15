import OpenAI from "openai";
import type { FreeWindow } from "@/lib/freeWindows";
import type { UserPreferences } from "@/lib/planning";
import { formatTime } from "@/lib/date";

const MODEL = "gpt-4o-mini";
const TRAINING_TYPES = ["Swim", "Bike", "Run", "Strength"] as const;
const INTENSITIES = ["Low", "Medium", "High"] as const;

export interface TriathlonSuggestion {
  title: string;
  type: (typeof TRAINING_TYPES)[number];
  start_time: string;
  end_time: string;
  location: string | null;
  intensity: (typeof INTENSITIES)[number];
  reason: string;
}

const SUGGESTIONS_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: [...TRAINING_TYPES] },
          start_time: {
            type: "string",
            description: "ISO 8601 datetime, must fall inside one of the given free windows",
          },
          end_time: {
            type: "string",
            description: "ISO 8601 datetime, must fall inside one of the given free windows",
          },
          location: { type: ["string", "null"] },
          intensity: { type: "string", enum: [...INTENSITIES] },
          reason: { type: "string" },
        },
        required: [
          "title",
          "type",
          "start_time",
          "end_time",
          "location",
          "intensity",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a triathlon training planning assistant. Given an athlete's preferences and their free time windows for the next 7 days, propose 4 to 6 specific training sessions.

Rules:
- Every session's start_time and end_time must fall entirely within one of the provided free windows (copy the window's start/end or use a sub-range inside it).
- type must be one of: Swim, Bike, Run, Strength.
- intensity must be one of: Low, Medium, High.
- Balance the four disciplines across the week rather than repeating one type.
- Never schedule two High intensity sessions on back-to-back days — leave recovery time between hard sessions, and prefer Low intensity or rest the day after a High intensity session.
- Respect the athlete's preferred/avoid training times and location notes where possible.
- Take the athlete's recovery notes (e.g. injuries) into account when choosing intensity and type.
- Each session should be a realistic duration for its type and intensity, typically 30-90 minutes.
- Write a short, specific "reason" for each session referencing the athlete's goal, race date, or preferences.
- start_time and end_time must be valid ISO 8601 datetime strings.
- Return between 4 and 6 suggestions.`;

function formatPreferences(preferences: UserPreferences | null): string {
  if (!preferences) {
    return "No saved preferences yet — use sensible general triathlon training defaults.";
  }
  return [
    `Race goal: ${preferences.race_goal || "Not specified"}`,
    `Race date: ${preferences.race_date || "Not specified"}`,
    `Weekly training hours target: ${preferences.weekly_training_hours ?? "Not specified"}`,
    `Preferred training times: ${preferences.preferred_training_times || "Not specified"}`,
    `Times to avoid: ${preferences.avoid_times || "Not specified"}`,
    `Location notes: ${preferences.location_notes || "Not specified"}`,
    `Recovery notes: ${preferences.recovery_notes || "Not specified"}`,
    `Other notes: ${preferences.free_text_memory || "Not specified"}`,
  ].join("\n");
}

function formatFreeWindows(freeWindows: FreeWindow[]): string {
  return freeWindows
    .map(
      (w) =>
        `- ${w.date}: ${formatTime(w.start)}–${formatTime(w.end)} (start_time=${w.start}, end_time=${w.end})`
    )
    .join("\n");
}

function buildUserPrompt(
  preferences: UserPreferences | null,
  freeWindows: FreeWindow[]
): string {
  return `Athlete preferences:\n${formatPreferences(preferences)}\n\nFree time windows over the next 7 days (only schedule sessions fully inside one of these):\n${formatFreeWindows(freeWindows)}`;
}

function isValidSuggestion(value: unknown): value is TriathlonSuggestion {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  if (typeof v.title !== "string" || !v.title.trim()) return false;
  if (typeof v.type !== "string" || !TRAINING_TYPES.includes(v.type as never))
    return false;
  if (typeof v.start_time !== "string" || Number.isNaN(Date.parse(v.start_time)))
    return false;
  if (typeof v.end_time !== "string" || Number.isNaN(Date.parse(v.end_time)))
    return false;
  if (new Date(v.end_time).getTime() <= new Date(v.start_time).getTime())
    return false;
  if (v.location !== null && typeof v.location !== "string") return false;
  if (
    typeof v.intensity !== "string" ||
    !INTENSITIES.includes(v.intensity as never)
  )
    return false;
  if (typeof v.reason !== "string" || !v.reason.trim()) return false;

  return true;
}

function fitsWithinAWindow(
  suggestion: TriathlonSuggestion,
  windows: FreeWindow[]
): boolean {
  const start = new Date(suggestion.start_time).getTime();
  const end = new Date(suggestion.end_time).getTime();
  return windows.some((w) => {
    const wStart = new Date(w.start).getTime();
    const wEnd = new Date(w.end).getTime();
    return start >= wStart && end <= wEnd;
  });
}

export function validateSuggestions(
  raw: unknown,
  freeWindows: FreeWindow[]
): TriathlonSuggestion[] {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as { suggestions?: unknown }).suggestions)
  ) {
    throw new Error("Model response did not include a suggestions array.");
  }

  const suggestions = (raw as { suggestions: unknown[] }).suggestions;
  const valid = suggestions
    .filter(isValidSuggestion)
    .filter((s) => fitsWithinAWindow(s, freeWindows))
    .slice(0, 6);

  if (valid.length === 0) {
    throw new Error("Model response contained no valid, schedulable suggestions.");
  }

  return valid;
}

export async function generateTriathlonSuggestions({
  preferences,
  freeWindows,
}: {
  preferences: UserPreferences | null;
  freeWindows: FreeWindow[];
}): Promise<TriathlonSuggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.5,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(preferences, freeWindows) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "triathlon_suggestions",
        strict: true,
        schema: SUGGESTIONS_SCHEMA,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from OpenAI.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Model returned invalid JSON.");
  }

  return validateSuggestions(parsed, freeWindows);
}
