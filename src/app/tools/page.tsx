import ToolCard from "@/components/ToolCard";
import { TOOLS, TOOL_CATEGORIES } from "@/lib/tools";

export default function ToolsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Tools Hub</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quick links to the tools you use across the MBA, grouped by what
          they&apos;re for.
        </p>
      </header>

      <div className="space-y-10">
        {TOOL_CATEGORIES.map((category) => {
          const items = TOOLS.filter((tool) => tool.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {category}
                <span className="h-px flex-1 bg-slate-200" />
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
