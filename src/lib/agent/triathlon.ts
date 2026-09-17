import OpenAI from "openai";
import type { FreeWindow } from "@/lib/freeWindows";
import type { UserPreferences } from "@/lib/planning";
import { formatTime } from "@/lib/date";
import { toDateKey } from "@/lib/week";
import {
  type HourlyWeather,
  formatWindowWeather,
  summarizeWindowWeather,
} from "@/lib/weather";

const MODEL = "gpt-4o-mini";
const TRAINING_TYPES = ["Swim", "Bike", "Run", "Brick", "Strength"] as const;
const INTENSITIES = ["Low", "Medium", "High"] as const;
const MAIN_TYPES = new Set<string>(["Swim", "Bike", "Run", "Brick"]);
const MIN_SUGGESTIONS = 2;
const MAX_SUGGESTIONS = 4;

export interface ExistingWorkout {
  type: string | null;
  start_time: string;
}

export interface TriathlonSuggestion {
  title: string;
  type: (typeof TRAINING_TYPES)[number];
  start_time: string;
  end_time: string;
  location: string | null;
  intensity: (typeof INTENSITIES)[number];
  distance: string | null;
  structure: string;
  pace_or_effort: string | null;
  plan_reference: string;
  reason: string;
  risk_warning: string | null;
}

const SUGGESTIONS_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      minItems: MIN_SUGGESTIONS,
      maxItems: MAX_SUGGESTIONS,
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
          distance: {
            type: ["string", "null"],
            description: "e.g. '80-95 km' or '1.7 km'; null if not applicable (e.g. pure mobility)",
          },
          structure: {
            type: "string",
            description: "Session structure, e.g. sets/reps/laps/route — not a generic placeholder",
          },
          pace_or_effort: {
            type: ["string", "null"],
            description: "Target pace or effort guidance, e.g. '~1:55/100m' or 'Zone 2 HR'",
          },
          plan_reference: {
            type: "string",
            description: "Which training-plan item this maps to, e.g. 'Week 3 Bike A', or 'Optional — reason'",
          },
          reason: {
            type: "string",
            description: "Why this workout, why this time, and logistics/buffer assumptions",
          },
          risk_warning: {
            type: ["string", "null"],
            description: "Any risk/conflict/tightness warning; null if none",
          },
        },
        required: [
          "title",
          "type",
          "start_time",
          "end_time",
          "location",
          "intensity",
          "distance",
          "structure",
          "pace_or_effort",
          "plan_reference",
          "reason",
          "risk_warning",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a triathlon training planning assistant, acting as a calendar-aware personal coach.

You will be given, in order:
1. Today's date.
2. The athlete's saved preferences (race goal, weekly hours, etc.).
3. An athlete training context document, if one is available. When present, treat it as the authoritative source of truth for this athlete's logistics, locations, commute, injury constraints, current training-plan week, and coaching rules — it takes priority over generic training advice below.
4. A list of free time windows computed from the athlete's actual calendar (Google Calendar events plus already-planned training sessions already excluded, with a buffer already applied).

Critical rule: a free calendar window is NOT automatically a usable training slot. Judge each window against the context document's logistics, buffer, location, and fatigue rules before using it. If a window is only technically free but would be rushed, badly located, or stacked against fatigue/injury risk, either avoid it, suggest a shorter/easier session instead, or clearly flag the risk in risk_warning.

Quality over quantity:
- You are suggesting the athlete's NEXT few workouts, not a full week. Return only ${MIN_SUGGESTIONS} to ${MAX_SUGGESTIONS} suggestions — a small, high-quality batch, never an attempt to fill every free window.
- Every suggestion must map to a specific item in the context document's current training-plan week (use today's date to determine which week). Put this in plan_reference, e.g. "Week 3 Bike A". If a suggestion does not map to a specific plan item, it must be clearly labelled optional in plan_reference along with why (e.g. "Optional — easy recovery spin, legs fresh").
- Do not invent generic extra workouts beyond the plan unless explicitly labelled optional as above.

No overlaps, ever:
- No suggested workout may overlap another suggested workout you return.
- No suggested workout may overlap a Google Calendar event or an existing planned/accepted training event — these are fixed commitments already excluded from the free windows below with a buffer. Stay strictly inside a window.
- Every session's start_time and end_time must fall entirely within one of the provided free windows.

Daily limits:
- Weekdays: at most one main session (Swim, Bike, Run, or Brick). A short Strength/mobility session may additionally be suggested on a weekday only if it is genuinely low-friction and does not overload legs before/after the main session.
- Weekends: at most two sessions, and only if realistic — either one intentional Brick, or two clearly compatible sessions with real recovery/logistics room between them.
- Never suggest more than one session of the same discipline on the same day.
- Never suggest swim + run + bike + strength all in the same morning.
- Never suggest another workout on the same evening as hockey training/a match, if that is on the calendar.

Brick sessions:
- A brick must be ONE suggestion with type "Brick", not two separate overlapping or adjacent Bike/Run tiles.
- Describe both components in distance (e.g. "Bike 35-45km + Run 2-3km") and structure (e.g. transition, pacing for each leg).
- Keep the run portion short and cautious per the context document's injury guidance.

Bike realism (apply the context document's exact numbers if it gives them; otherwise use these defaults):
- A dedicated outdoor ride should be at least 90 minutes door-to-door.
- A normal quality outdoor ride is usually 1.5-3+ hours.
- A long endurance ride is usually 2.5-4.25 hours.
- A bike session of 45-75 minutes is only realistic if it is explicitly a recovery spin, turbo/indoor session, commute-based light aerobic ride, or short taper-week ride — say which in structure or reason. Do not suggest a short "long ride" or a short dedicated outdoor Richmond-Park-style ride.

Weather awareness (a secondary factor — calendar fit, athlete context, training-plan mapping, buffers, and fatigue/already-accepted workouts still matter more than weather):
- Some free windows below include a live weather summary (temperature, rain chance, wind) from the UK Met Office forecast. Where present, weigh it when choosing which window suits which session — but never let it override the core rules above, and never invent conditions for a window with no weather summary.
- Heavy rain or high wind (gusts roughly 40km/h+): avoid placing a long outdoor bike in that window if a workable alternative window or session exists — prefer swim, strength/gym, turbo/indoor bike, or a shorter indoor option instead.
- A calm, dry window: outdoor run or an outdoor ride (e.g. Richmond Park) becomes a more attractive choice for that slot.
- Cold, dark ("before sunrise/after sunset"), or wet early mornings: add a brief caution in reason, or suggest an indoor alternative if one is realistic for the session type.
- Windy conditions: avoid exposed long rides, or clearly flag the wind risk in risk_warning.
- Warm conditions (roughly 20°C+): mention hydration and pace/intensity caution in reason for longer or harder sessions.
- When weather meaningfully influenced why a suggestion was placed in its window, add one short weather sentence to reason, e.g. "Weather looks dry and calm, so this is a good outdoor bike slot."

Required detail — every suggestion must include real values, not placeholders:
- type: one of Swim, Bike, Run, Brick, Strength.
- intensity: one of Low, Medium, High.
- distance: a concrete distance/range where relevant to the discipline (null only when genuinely not applicable, e.g. pure mobility/core work).
- structure: the actual session structure (sets, reps, route, laps, transition plan) — never a generic placeholder like "training session".
- pace_or_effort: concrete pace or effort guidance where relevant (null if not applicable).
- plan_reference: required, as described above.
- reason: why this workout, why this time, and the key logistics/buffer assumptions behind placing it there.
- risk_warning: any tightness, fatigue, or conflict risk worth flagging; null if there genuinely is none.
- Never schedule two High intensity sessions on back-to-back days — leave recovery time, and prefer Low intensity or rest the day after a High intensity session.
- Take injury guidance (e.g. IT band caution) in the context document into account for type, intensity, and progression of any Run or Brick.
- start_time and end_time must be valid ISO 8601 datetime strings.
- Return between ${MIN_SUGGESTIONS} and ${MAX_SUGGESTIONS} suggestions.`;

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

function formatFreeWindows(
  freeWindows: FreeWindow[],
  weatherHourly: HourlyWeather[] | null
): string {
  return freeWindows
    .map((w) => {
      const base = `- ${w.date}: ${formatTime(w.start)}–${formatTime(w.end)} (start_time=${w.start}, end_time=${w.end})`;
      if (!weatherHourly || weatherHourly.length === 0) return base;
      const summary = summarizeWindowWeather(weatherHourly, w.start, w.end);
      if (!summary) return base;
      return `${base} — weather: ${formatWindowWeather(summary)}`;
    })
    .join("\n");
}

function buildUserPrompt(
  preferences: UserPreferences | null,
  freeWindows: FreeWindow[],
  athleteContext: string | null,
  today: Date,
  weatherHourly: HourlyWeather[] | null
): string {
  const sections = [
    `Today's date: ${toDateKey(today)}`,
    `Athlete preferences (saved settings):\n${formatPreferences(preferences)}`,
    athleteContext
      ? `Athlete training context document (authoritative — use this for logistics, location, fatigue, injury, training-plan week, and race-plan judgment):\n\n${athleteContext}`
      : "No athlete training context document is available for this request — use the saved preferences above and general triathlon coaching judgment only.",
    `Free time windows over the next 7 days (candidate slots only — do not treat every window as automatically usable; judge each against the context document's logistics/fatigue rules, and the weather summary where present, before using it):\n${formatFreeWindows(freeWindows, weatherHourly)}`,
  ];
  return sections.join("\n\n---\n\n");
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
  if (v.distance !== null && typeof v.distance !== "string") return false;
  if (typeof v.structure !== "string" || !v.structure.trim()) return false;
  if (v.pace_or_effort !== null && typeof v.pace_or_effort !== "string")
    return false;
  if (typeof v.plan_reference !== "string" || !v.plan_reference.trim())
    return false;
  if (typeof v.reason !== "string" || !v.reason.trim()) return false;
  if (v.risk_warning !== null && typeof v.risk_warning !== "string")
    return false;

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

function durationMinutes(suggestion: TriathlonSuggestion): number {
  return (
    (new Date(suggestion.end_time).getTime() -
      new Date(suggestion.start_time).getTime()) /
    60000
  );
}

const SHORT_BIKE_KEYWORDS = ["recovery", "turbo", "indoor", "commute", "taper", "easy spin"];

function passesBikeRealism(suggestion: TriathlonSuggestion): boolean {
  if (suggestion.type !== "Bike") return true;
  if (durationMinutes(suggestion) >= 90) return true;
  const text = `${suggestion.structure} ${suggestion.reason} ${suggestion.plan_reference}`.toLowerCase();
  return SHORT_BIKE_KEYWORDS.some((kw) => text.includes(kw));
}

function suggestionsOverlap(
  a: TriathlonSuggestion,
  b: TriathlonSuggestion
): boolean {
  const aStart = new Date(a.start_time).getTime();
  const aEnd = new Date(a.end_time).getTime();
  const bStart = new Date(b.start_time).getTime();
  const bEnd = new Date(b.end_time).getTime();
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Greedily keeps suggestions in the model's own returned order (treated as
 * its priority ranking) and discards any later suggestion that overlaps one
 * already kept.
 */
function removeOverlappingSuggestions(
  suggestions: TriathlonSuggestion[]
): TriathlonSuggestion[] {
  const kept: TriathlonSuggestion[] = [];
  for (const s of suggestions) {
    if (!kept.some((k) => suggestionsOverlap(k, s))) {
      kept.push(s);
    }
  }
  return kept;
}

/**
 * Enforces: at most one session per discipline per day, at most one main
 * session (Swim/Bike/Run/Brick) on a weekday, at most two on a weekend.
 * Operates chronologically so earlier-in-the-day sessions are kept first.
 * Seeded with already-accepted plan_events so new suggestions plan around
 * them (e.g. won't add a second same-day Run on top of an accepted one).
 */
function enforceDailyLimits(
  suggestions: TriathlonSuggestion[],
  existingWorkouts: ExistingWorkout[] = []
): TriathlonSuggestion[] {
  const sorted = [...suggestions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const typesUsedByDay = new Map<string, Set<string>>();
  const mainCountByDay = new Map<string, number>();

  for (const w of existingWorkouts) {
    if (!w.type) continue;
    const dateKey = toDateKey(new Date(w.start_time));
    const typesUsed = typesUsedByDay.get(dateKey) ?? new Set<string>();
    typesUsed.add(w.type);
    typesUsedByDay.set(dateKey, typesUsed);
    if (MAIN_TYPES.has(w.type)) {
      mainCountByDay.set(dateKey, (mainCountByDay.get(dateKey) ?? 0) + 1);
    }
  }

  const kept: TriathlonSuggestion[] = [];

  for (const s of sorted) {
    const day = new Date(s.start_time);
    const dateKey = toDateKey(day);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const typesUsed = typesUsedByDay.get(dateKey) ?? new Set<string>();

    if (typesUsed.has(s.type)) continue;

    if (MAIN_TYPES.has(s.type)) {
      const mainCount = mainCountByDay.get(dateKey) ?? 0;
      const cap = isWeekend ? 2 : 1;
      if (mainCount >= cap) continue;
      mainCountByDay.set(dateKey, mainCount + 1);
    }

    typesUsed.add(s.type);
    typesUsedByDay.set(dateKey, typesUsed);
    kept.push(s);
  }

  return kept;
}

export function validateSuggestions(
  raw: unknown,
  freeWindows: FreeWindow[],
  existingWorkouts: ExistingWorkout[] = []
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
    .filter(passesBikeRealism);

  const nonOverlapping = removeOverlappingSuggestions(valid);
  const withinDailyLimits = enforceDailyLimits(nonOverlapping, existingWorkouts)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, MAX_SUGGESTIONS);

  if (withinDailyLimits.length === 0) {
    throw new Error(
      "Model response contained no valid, non-overlapping, schedulable suggestions."
    );
  }

  return withinDailyLimits;
}

export async function generateTriathlonSuggestions({
  preferences,
  freeWindows,
  athleteContext,
  existingWorkouts = [],
  today = new Date(),
  weatherHourly = null,
}: {
  preferences: UserPreferences | null;
  freeWindows: FreeWindow[];
  athleteContext: string | null;
  existingWorkouts?: ExistingWorkout[];
  today?: Date;
  weatherHourly?: HourlyWeather[] | null;
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
      {
        role: "user",
        content: buildUserPrompt(preferences, freeWindows, athleteContext, today, weatherHourly),
      },
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

  return validateSuggestions(parsed, freeWindows, existingWorkouts);
}
