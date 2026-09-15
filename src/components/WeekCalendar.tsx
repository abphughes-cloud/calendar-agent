"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategorizedEvent } from "@/lib/category";
import { ALL_CATEGORIES, categoryStyle } from "@/lib/category";
import type { PlanEvent } from "@/lib/planning";
import { layoutOverlaps } from "@/lib/layout";
import { addDays, formatDayHeader, formatWeekRangeLabel, startOfWeek, toDateKey } from "@/lib/week";
import EventBlock from "@/components/EventBlock";
import EventDetailModal from "@/components/EventDetailModal";
import PlanEventBlock from "@/components/PlanEventBlock";
import PlanEventModal from "@/components/PlanEventModal";

const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_PX = 48;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;
const DAY_COLUMN_MIN_WIDTH = 240;

function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function computeBlockPosition(startIso: string, endIso: string | null) {
  const gridStartMin = START_HOUR * 60;
  const gridEndMin = END_HOUR * 60;
  const rawStart = minutesOfDay(startIso);
  const rawEnd = endIso ? minutesOfDay(endIso) : rawStart + 30;

  const start = Math.min(Math.max(rawStart, gridStartMin), gridEndMin);
  const end = Math.min(Math.max(Math.max(rawEnd, rawStart + 20), gridStartMin), gridEndMin);

  const top = ((start - gridStartMin) / (gridEndMin - gridStartMin)) * GRID_HEIGHT;
  const height = Math.max(
    ((end - start) / (gridEndMin - gridStartMin)) * GRID_HEIGHT,
    22
  );

  return { top, height };
}

function blockPosition(event: CategorizedEvent) {
  return computeBlockPosition(event.start ?? new Date().toISOString(), event.end);
}

function planBlockPosition(event: PlanEvent) {
  return computeBlockPosition(event.start_time, event.end_time);
}

export default function WeekCalendar({
  weekStart,
  events,
  planEvents,
}: {
  weekStart: Date;
  events: CategorizedEvent[];
  planEvents: PlanEvent[];
}) {
  const [selectedEvent, setSelectedEvent] = useState<CategorizedEvent | null>(
    null
  );
  const [selectedPlanEvent, setSelectedPlanEvent] = useState<PlanEvent | null>(
    null
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = toDateKey(new Date());

  const eventsByDay = new Map<string, CategorizedEvent[]>();
  for (const event of events) {
    if (!event.start) continue;
    const key = event.isAllDay ? event.start : toDateKey(new Date(event.start));
    const list = eventsByDay.get(key) ?? [];
    list.push(event);
    eventsByDay.set(key, list);
  }

  const planEventsByDay = new Map<string, PlanEvent[]>();
  for (const event of planEvents) {
    const key = toDateKey(new Date(event.start_time));
    const list = planEventsByDay.get(key) ?? [];
    list.push(event);
    planEventsByDay.set(key, list);
  }

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );

  const prevWeekHref = `/?week=${toDateKey(addDays(weekStart, -7))}`;
  const nextWeekHref = `/?week=${toDateKey(addDays(weekStart, 7))}`;
  const todayHref = `/?week=${toDateKey(startOfWeek(new Date()))}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={prevWeekHref}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Prev
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {formatWeekRangeLabel(weekStart)}
          </h2>
          <Link
            href={todayHref}
            className="text-xs font-medium text-gray-400 underline hover:text-gray-600"
          >
            Today
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/plan/new"
            className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            + Add plan event
          </Link>
          <Link
            href={nextWeekHref}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {ALL_CATEGORIES.map((category) => (
          <div key={category} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${categoryStyle(category).dotClass}`}
            />
            <span className="text-xs text-gray-500">{category}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-indigo-400 bg-indigo-50" />
          <span className="text-xs text-gray-500">Plan (not on Google)</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="flex">
          <div className="sticky left-0 z-10 w-12 flex-shrink-0 bg-white">
            <div className="h-12 border-b border-gray-200" />
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-t border-gray-100 pr-1 text-right text-[10px] text-gray-400"
                style={{ height: HOUR_PX }}
              >
                {new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", {
                  hour: "numeric",
                })}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayKey = toDateKey(day);
            const { weekday, day: dayNum } = formatDayHeader(day);
            const dayEvents = eventsByDay.get(dayKey) ?? [];
            const allDayEvents = dayEvents.filter((e) => e.isAllDay);
            const timedEvents = dayEvents.filter((e) => !e.isAllDay);
            const dayPlanEvents = planEventsByDay.get(dayKey) ?? [];

            const laidOut = layoutOverlaps(
              timedEvents,
              (e) => new Date(e.start as string).getTime(),
              (e) => new Date(e.end ?? (e.start as string)).getTime()
            );

            const laidOutPlan = layoutOverlaps(
              dayPlanEvents,
              (e) => new Date(e.start_time).getTime(),
              (e) => new Date(e.end_time).getTime()
            );

            return (
              <div
                key={dayKey}
                className="flex-1 border-l border-gray-100"
                style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}
              >
                <div className="flex h-12 flex-col items-center justify-center border-b border-gray-200">
                  <span className="text-[10px] uppercase text-gray-400">
                    {weekday}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      dayKey === todayKey
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white"
                        : "text-gray-700"
                    }`}
                  >
                    {dayNum}
                  </span>
                </div>

                {allDayEvents.length > 0 && (
                  <div className="space-y-0.5 border-b border-gray-100 p-1">
                    {allDayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        title={[event.title, "All day", event.location, event.category]
                          .filter(Boolean)
                          .join("\n")}
                        onClick={() => setSelectedEvent(event)}
                        className={`block w-full cursor-pointer truncate rounded border-l-4 px-1.5 py-0.5 text-left text-xs font-medium transition hover:brightness-95 ${event.colorClass}`}
                      >
                        {event.title}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative" style={{ height: GRID_HEIGHT }}>
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-gray-100"
                      style={{ top: (hour - START_HOUR) * HOUR_PX }}
                    />
                  ))}

                  {laidOut.map(({ event, column, columnCount }) => {
                    const { top, height } = blockPosition(event);
                    return (
                      <EventBlock
                        key={event.id}
                        event={event}
                        top={top}
                        height={height}
                        left={`calc(${(column / columnCount) * 100}% + 1px)`}
                        width={`calc(${100 / columnCount}% - 2px)`}
                        onSelect={setSelectedEvent}
                      />
                    );
                  })}

                  {laidOutPlan.map(({ event, column, columnCount }) => {
                    const { top, height } = planBlockPosition(event);
                    return (
                      <PlanEventBlock
                        key={event.id}
                        event={event}
                        top={top}
                        height={height}
                        left={`calc(${(column / columnCount) * 100}% + 1px)`}
                        width={`calc(${100 / columnCount}% - 2px)`}
                        onSelect={setSelectedPlanEvent}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
      <PlanEventModal
        event={selectedPlanEvent}
        onClose={() => setSelectedPlanEvent(null)}
      />
    </div>
  );
}
