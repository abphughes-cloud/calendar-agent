import type { CalendarFetchResult } from "@/lib/calendar";

export default function CalendarDebugPanel({
  calendars,
  perCalendarCounts,
}: {
  calendars: CalendarFetchResult["calendars"];
  perCalendarCounts: CalendarFetchResult["perCalendarCounts"];
}) {
  const countsById = new Map(perCalendarCounts.map((c) => [c.calendarId, c]));

  return (
    <details className="mt-10 rounded-lg border border-gray-200 bg-white text-sm">
      <summary className="cursor-pointer select-none p-3 font-medium text-gray-600">
        Debug: calendars found ({calendars.length})
      </summary>
      <div className="overflow-x-auto border-t border-gray-200 p-3">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="py-1 pr-3">Name</th>
              <th className="py-1 pr-3">ID</th>
              <th className="py-1 pr-3">selected</th>
              <th className="py-1 pr-3">hidden</th>
              <th className="py-1 pr-3">accessRole</th>
              <th className="py-1 pr-3">included</th>
              <th className="py-1 pr-3">events / error</th>
            </tr>
          </thead>
          <tbody>
            {calendars.map((cal) => {
              const counts = countsById.get(cal.id);
              return (
                <tr key={cal.id} className="border-t border-gray-100">
                  <td className="py-1 pr-3 font-medium text-gray-700">
                    {cal.summary}
                    {cal.primary ? " (primary)" : ""}
                  </td>
                  <td className="py-1 pr-3 break-all text-gray-400">{cal.id}</td>
                  <td className="py-1 pr-3">{String(cal.selected ?? "—")}</td>
                  <td className="py-1 pr-3">{String(cal.hidden ?? "—")}</td>
                  <td className="py-1 pr-3">{cal.accessRole ?? "—"}</td>
                  <td className="py-1 pr-3">
                    {cal.included ? (
                      <span className="text-green-600">yes</span>
                    ) : (
                      <span className="text-gray-400">no</span>
                    )}
                  </td>
                  <td className="py-1 pr-3">
                    {counts?.error ? (
                      <span className="text-red-500">{counts.error}</span>
                    ) : (
                      (counts?.count ?? "—")
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
