"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategorizedEvent } from "@/lib/category";
import { ALL_CATEGORIES, categoryStyle } from "@/lib/category";
import type { AgentSuggestion, PlanEvent } from "@/lib/planning";
import type { HourlyWeather } from "@/lib/weather";
import { layoutOverlaps } from "@/lib/layout";
import { addDays, formatDayHeader, formatWeekRangeLabel, startOfWeek, toDateKey } from "@/lib/week";
import EventBlock from "@/components/EventBlock";
import EventDetailModal from "@/components/EventDetailModal";
import PlanEventBlock from "@/components/PlanEventBlock";
import PlanEventModal from "@/components/PlanEventModal";
import SuggestionBlock from "@/components/SuggestionBlock";
import SuggestionDetailModal from "@/components/SuggestionDetailModal";
import WeatherColumn, { WEATHER_COLUMN_WIDTH } from "@/components/WeatherColumn";
import { checkSuggestionDuration, checkSuggestionPlacement } from "@/lib/agent/suggestionPlacement";
import { updateSuggestion } from "@/app/agent/actions";

const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_PX = 48;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;
// Room for the event/suggestion grid plus its dedicated weather lane.
const DAY_COLUMN_MIN_WIDTH = 240 + WEATHER_COLUMN_WIDTH;
const PX_PER_MINUTE = HOUR_PX / 60;

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

const SUGGESTION_MIN_HEIGHT = 40;

function suggestionBlockPosition(suggestion: AgentSuggestion) {
  if (!suggestion.start_time) {
    return { top: 0, height: SUGGESTION_MIN_HEIGHT };
  }
  const pos = computeBlockPosition(suggestion.start_time, suggestion.end_time);
  return { ...pos, height: Math.max(pos.height, SUGGESTION_MIN_HEIGHT) };
}

function suggestionConflicts(
  suggestion: AgentSuggestion,
  events: CategorizedEvent[],
  planEvents: PlanEvent[]
): boolean {
  if (!suggestion.start_time || !suggestion.end_time) return false;
  const sStart = new Date(suggestion.start_time).getTime();
  const sEnd = new Date(suggestion.end_time).getTime();

  const overlapsGoogle = events.some((e) => {
    if (e.isAllDay || !e.start) return false;
    const eStart = new Date(e.start).getTime();
    const eEnd = new Date(e.end ?? e.start).getTime();
    return sStart < eEnd && sEnd > eStart;
  });
  if (overlapsGoogle) return true;

  return planEvents.some((p) => {
    const pStart = new Date(p.start_time).getTime();
    const pEnd = new Date(p.end_time).getTime();
    return sStart < pEnd && sEnd > pStart;
  });
}

export default function WeekCalendar({
  weekStart,
  events,
  planEvents,
  suggestions,
  weather,
  onSuggestionRemoved,
  onSuggestionUpdated,
  onPlacementError,
}: {
  weekStart: Date;
  events: CategorizedEvent[];
  planEvents: PlanEvent[];
  suggestions: AgentSuggestion[];
  weather: HourlyWeather[];
  onSuggestionRemoved: (id: string) => void;
  onSuggestionUpdated: (updated: AgentSuggestion) => void;
  onPlacementError: (message: string) => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<CategorizedEvent | null>(
    null
  );
  const [selectedPlanEvent, setSelectedPlanEvent] = useState<PlanEvent | null>(
    null
  );
  // Only the id is kept as state; the suggestion itself is derived from the
  // authoritative `suggestions` list below. Storing the object directly
  // would go stale the moment an edit is saved while the modal stays open
  // (e.g. a same-session Accept click would then persist pre-edit values).
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<
    string | null
  >(null);
  const selectedSuggestion =
    suggestions.find((s) => s.id === selectedSuggestionId) ?? null;

  async function commitSuggestionChange(
    suggestion: AgentSuggestion,
    newStart: Date,
    newEnd: Date
  ) {
    const placement = checkSuggestionPlacement({
      start: newStart,
      end: newEnd,
      events,
      planEvents,
      suggestions,
      excludeSuggestionId: suggestion.id,
    });
    if (!placement.ok) {
      onPlacementError(
        placement.message ?? "This move conflicts with another event or does not leave enough buffer."
      );
      return;
    }

    const minutes = (newEnd.getTime() - newStart.getTime()) / 60000;
    const contextText = [suggestion.structure, suggestion.reason, suggestion.plan_reference]
      .filter(Boolean)
      .join(" ");
    const durationCheck = checkSuggestionDuration(suggestion.type, minutes, contextText);
    if (!durationCheck.ok) {
      onPlacementError(
        durationCheck.message ?? "That duration isn't realistic for this discipline."
      );
      return;
    }

    try {
      const updated = await updateSuggestion(suggestion.id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });
      onSuggestionUpdated(updated);
    } catch (error) {
      onPlacementError(
        error instanceof Error ? error.message : "Could not save the change."
      );
    }
  }

  function handleResizeEnd(suggestion: AgentSuggestion, newEnd: Date) {
    if (!suggestion.start_time) return;
    commitSuggestionChange(suggestion, new Date(suggestion.start_time), newEnd);
  }

  // Called once a pointer-driven tile drag ends (see SuggestionBlock), with
  // the day column it was released over (by data-day-key) and the raw
  // minutes-from-grid-start of the release point (already 15-min snapped).
  function handleSuggestionDragEnd(
    suggestion: AgentSuggestion,
    dayKey: string,
    minutesFromGridStart: number
  ) {
    if (!suggestion.start_time || !suggestion.end_time) return;
    const day = days.find((d) => toDateKey(d) === dayKey);
    if (!day) return;

    const clampedMinutes = Math.max(
      0,
      Math.min((END_HOUR - START_HOUR) * 60, minutesFromGridStart)
    );

    const newStart = new Date(day);
    newStart.setHours(START_HOUR, 0, 0, 0);
    newStart.setMinutes(newStart.getMinutes() + clampedMinutes);

    const durationMs =
      new Date(suggestion.end_time).getTime() - new Date(suggestion.start_time).getTime();
    let newEnd = new Date(newStart.getTime() + durationMs);

    const gridEndForDay = new Date(day);
    gridEndForDay.setHours(END_HOUR, 0, 0, 0);
    if (newEnd > gridEndForDay) {
      const overflow = newEnd.getTime() - gridEndForDay.getTime();
      newStart.setTime(newStart.getTime() - overflow);
      newEnd = new Date(newStart.getTime() + durationMs);
    }

    commitSuggestionChange(suggestion, newStart, newEnd);
  }

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

  const suggestionsByDay = new Map<string, AgentSuggestion[]>();
  for (const suggestion of suggestions) {
    if (!suggestion.start_time) continue;
    const key = toDateKey(new Date(suggestion.start_time));
    const list = suggestionsByDay.get(key) ?? [];
    list.push(suggestion);
    suggestionsByDay.set(key, list);
  }

  const weatherByDay = new Map<string, HourlyWeather[]>();
  for (const hour of weather) {
    const key = toDateKey(new Date(hour.time));
    const list = weatherByDay.get(key) ?? [];
    list.push(hour);
    weatherByDay.set(key, list);
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
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Prev
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {formatWeekRangeLabel(weekStart)}
          </h2>
          <Link
            href={todayHref}
            className="text-xs font-medium text-slate-400 underline hover:text-slate-600"
          >
            Today
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/plan/new"
            className="rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-200"
          >
            + Add plan event
          </Link>
          <Link
            href={nextWeekHref}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
            <span className="text-xs text-slate-500">{category}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />
          <span className="text-xs text-slate-500">Plan (not on Google)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-blue-700 bg-blue-100" />
          <span className="text-xs text-slate-500">Suggested</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-red-600 bg-red-50" />
          <span className="text-xs text-slate-500">Suggested · Conflict</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className="flex">
          <div className="sticky left-0 z-10 w-12 flex-shrink-0 bg-white">
            <div className="h-12 border-b border-slate-200" />
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-t border-slate-100 pr-1 text-right text-[10px] text-slate-400"
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
            const daySuggestions = suggestionsByDay.get(dayKey) ?? [];
            const dayWeather = weatherByDay.get(dayKey) ?? [];

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

            const laidOutSuggestions = layoutOverlaps(
              daySuggestions,
              (e) => new Date(e.start_time as string).getTime(),
              (e) => new Date(e.end_time as string).getTime()
            );

            return (
              <div
                key={dayKey}
                className="flex-1 border-l border-slate-100"
                style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}
              >
                <div className="flex h-12 flex-col items-center justify-center border-b border-slate-200">
                  <span className="text-[10px] uppercase text-slate-400">
                    {weekday}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      dayKey === todayKey
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
                        : "text-slate-700"
                    }`}
                  >
                    {dayNum}
                  </span>
                </div>

                {allDayEvents.length > 0 && (
                  <div className="space-y-0.5 border-b border-slate-100 p-1">
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

                <div className="flex">
                  <WeatherColumn
                    hourly={dayWeather}
                    hours={hours}
                    startHour={START_HOUR}
                    hourPx={HOUR_PX}
                  />

                  <div
                    className="relative flex-1"
                    style={{ height: GRID_HEIGHT }}
                    data-day-key={dayKey}
                  >
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-slate-100"
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

                    {laidOutSuggestions.map(({ event, column, columnCount }) => {
                      const { top, height } = suggestionBlockPosition(event);
                      return (
                        <SuggestionBlock
                          key={event.id}
                          suggestion={event}
                          top={top}
                          height={height}
                          left={`calc(${(column / columnCount) * 100}% + 1px)`}
                          width={`calc(${100 / columnCount}% - 2px)`}
                          conflict={suggestionConflicts(event, events, planEvents)}
                          pxPerMinute={PX_PER_MINUTE}
                          onSelect={(s) => setSelectedSuggestionId(s.id)}
                          onResizeEnd={handleResizeEnd}
                          onDragEnd={handleSuggestionDragEnd}
                        />
                      );
                    })}
                  </div>
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
      <SuggestionDetailModal
        key={selectedSuggestion?.id ?? "none"}
        suggestion={selectedSuggestion}
        conflict={
          selectedSuggestion
            ? suggestionConflicts(selectedSuggestion, events, planEvents)
            : false
        }
        events={events}
        planEvents={planEvents}
        suggestions={suggestions}
        onClose={() => setSelectedSuggestionId(null)}
        onRemoved={onSuggestionRemoved}
        onUpdated={onSuggestionUpdated}
      />
    </div>
  );
}
