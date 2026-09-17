import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import PlanEventForm from "../../PlanEventForm";
import { updatePlanEvent } from "../../actions";

export default async function EditPlanEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: planEvent } = await supabase
    .from("plan_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!planEvent) notFound();

  const boundUpdate = updatePlanEvent.bind(null, id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          Edit plan event
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Back to calendar
        </Link>
      </div>
      <PlanEventForm
        action={boundUpdate}
        defaultValues={planEvent}
        submitLabel="Save changes"
      />
    </main>
  );
}
