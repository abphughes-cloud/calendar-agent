import { toDateKey } from "@/lib/week";

export interface BusyInterval {
  start: string | null;
  end: string | null;
  isAllDay: boolean;
}

export interface FreeWindow {
  date: string;
  start: string;
  end: string;
}

const WAKE_START = { hour: 6, minute: 30 };
const WAKE_END = { hour: 22, minute: 0 };
const BUFFER_MINUTES = 30;
const MIN_WINDOW_MINUTES = 20;

/**
 * Computes free time windows within waking hours (06:30–22:00) for each
 * given day, treating every timed busy interval as blocked plus a 30
 * minute buffer on either side. All-day events don't block specific
 * hours and are ignored here.
 */
export function computeFreeWindows(
  busy: BusyInterval[],
  days: Date[],
  now: Date = new Date()
): FreeWindow[] {
  const buffered = busy
    .filter((b): b is BusyInterval & { start: string } =>
      !b.isAllDay && Boolean(b.start)
    )
    .map((b) => {
      const start = new Date(b.start);
      const end = b.end ? new Date(b.end) : new Date(start.getTime() + 30 * 60000);
      return {
        start: new Date(start.getTime() - BUFFER_MINUTES * 60000),
        end: new Date(end.getTime() + BUFFER_MINUTES * 60000),
      };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const windows: FreeWindow[] = [];
  const todayKey = toDateKey(now);

  for (const day of days) {
    const wakeStart = new Date(day);
    wakeStart.setHours(WAKE_START.hour, WAKE_START.minute, 0, 0);
    const wakeEnd = new Date(day);
    wakeEnd.setHours(WAKE_END.hour, WAKE_END.minute, 0, 0);

    let cursor =
      toDateKey(day) === todayKey && now > wakeStart ? now : wakeStart;
    if (cursor >= wakeEnd) continue;

    const dayBusy = buffered.filter(
      (b) => b.end > wakeStart && b.start < wakeEnd
    );

    const pushWindow = (start: Date, end: Date) => {
      const minutes = (end.getTime() - start.getTime()) / 60000;
      if (minutes >= MIN_WINDOW_MINUTES) {
        windows.push({
          date: toDateKey(day),
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }
    };

    for (const b of dayBusy) {
      if (b.start > cursor) {
        pushWindow(cursor, new Date(Math.min(b.start.getTime(), wakeEnd.getTime())));
      }
      if (b.end > cursor) cursor = b.end;
    }
    if (cursor < wakeEnd) {
      pushWindow(cursor, wakeEnd);
    }
  }

  return windows;
}
