import TodoTaskCard from "@/components/TodoTaskCard";
import { DEMO_TASKS, TASK_BUCKETS } from "@/lib/demoTasks";

export default function TodoPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Academic To-Do</h1>
        <p className="mt-1 text-sm text-slate-500">
          A unified view of what&apos;s due, pulled together from Canvas and
          Outlook.
        </p>
      </header>

      <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
        Demo data — not yet connected to Canvas or Outlook
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_BUCKETS.map((bucket) => {
          const items = DEMO_TASKS.filter((task) => task.bucket === bucket);
          return (
            <section
              key={bucket}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
            >
              <h2 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                {bucket}
                <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-500 shadow-sm">
                  {items.length}
                </span>
              </h2>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400">Nothing here.</p>
                ) : (
                  items.map((task) => (
                    <TodoTaskCard key={task.title} task={task} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
