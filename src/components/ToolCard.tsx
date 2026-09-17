import type { ToolLink } from "@/lib/tools";

export default function ToolCard({ tool }: { tool: ToolLink }) {
  const disabled = !tool.href;
  const external = tool.external ?? true;

  const body = (
    <>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {tool.icon && (
            <span className="text-base leading-none" aria-hidden="true">
              {tool.icon}
            </span>
          )}
          <h3 className="text-sm font-semibold text-slate-900">{tool.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
          {tool.category}
        </span>
      </div>
      {tool.description && (
        <p className="text-xs leading-relaxed text-slate-500">{tool.description}</p>
      )}
      {tool.tags && tool.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tool.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {disabled && (
        <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Coming soon
        </p>
      )}
    </>
  );

  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 opacity-70">
        {body}
      </div>
    );
  }

  return (
    <a
      href={tool.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      {body}
    </a>
  );
}
