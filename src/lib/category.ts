import type { CalendarEvent } from "@/lib/calendar";

export type EventCategory =
  | "Hockey"
  | "Academic"
  | "Clubs"
  | "Social"
  | "Holiday"
  | "Other";

interface CategoryStyle {
  category: EventCategory;
  /** Tailwind classes for an event block in the week grid. */
  colorClass: string;
  /** Tailwind class for the small legend/category dot. */
  dotClass: string;
}

const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  Hockey: {
    category: "Hockey",
    colorClass: "bg-blue-100 border-blue-500 text-blue-900",
    dotClass: "bg-blue-500",
  },
  Academic: {
    category: "Academic",
    colorClass: "bg-orange-100 border-orange-500 text-orange-900",
    dotClass: "bg-orange-500",
  },
  Clubs: {
    category: "Clubs",
    colorClass: "bg-green-100 border-green-500 text-green-900",
    dotClass: "bg-green-500",
  },
  Social: {
    category: "Social",
    colorClass: "bg-purple-100 border-purple-500 text-purple-900",
    dotClass: "bg-purple-500",
  },
  Holiday: {
    category: "Holiday",
    colorClass: "bg-gray-200 border-gray-500 text-gray-900",
    dotClass: "bg-gray-500",
  },
  Other: {
    category: "Other",
    colorClass: "bg-slate-100 border-slate-400 text-slate-900",
    dotClass: "bg-slate-500",
  },
};

export const ALL_CATEGORIES: EventCategory[] = [
  "Hockey",
  "Academic",
  "Clubs",
  "Social",
  "Holiday",
  "Other",
];

/**
 * Maps a source calendar (and, in future, event title) to a display category.
 * Order matters: the first matching rule wins.
 */
export function categorizeEvent(
  calendarSummary: string,
  _eventTitle: string
): EventCategory {
  const name = calendarSummary.toLowerCase();

  if (name.includes("lwf")) return "Hockey";
  if (name.includes("lbs")) return "Academic";
  if (name.includes("roundabout")) return "Clubs";
  if (name.includes("calendar")) return "Social";
  if (name.includes("holiday")) return "Holiday";
  return "Other";
}

export function categoryStyle(category: EventCategory): CategoryStyle {
  return CATEGORY_STYLES[category];
}

export interface CategorizedEvent extends CalendarEvent {
  category: EventCategory;
  colorClass: string;
}

export function withCategory(event: CalendarEvent): CategorizedEvent {
  const category = categorizeEvent(event.calendarSummary, event.title);
  return { ...event, category, colorClass: categoryStyle(category).colorClass };
}
