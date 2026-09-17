import type { DemoTask } from "@/lib/demoTasks";

const SOURCE_STYLES: Record<DemoTask["source"], string> = {
  Canvas: "bg-orange-100 text-orange-700",
  Outlook: "bg-blue-100 text-blue-700",
  Manual: "bg-slate-100 text-slate-600",
};

const PRIORITY_STYLES: Record<DemoTask["priority"], string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-500",
};

export default function TodoTaskCard({ task }: { task: DemoTask }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-900">{task.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SOURCE_STYLES[task.source]}`}
        >
          {task.source}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>{task.dueDate}</span>
        {task.course && (
          <>
            <span className="text-slate-300">·</span>
            <span>{task.course}</span>
          </>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[task.priority]}`}
        >
          {task.priority}
        </span>
        <span className="text-slate-400">{task.status}</span>
      </div>
    </div>
  );
}
