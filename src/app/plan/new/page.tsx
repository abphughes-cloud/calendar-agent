import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import PlanEventForm from "../PlanEventForm";
import { createPlanEvent, createPlanEventFromSuggestion } from "../actions";
import type { PlanEvent } from "@/lib/planning";

export default async function NewPlanEventPage({
  searchParams,
}: {
  searchParams: Promise<{ fromSuggestion?: string }>;
}) {
  const { fromSuggestion } = await searchParams;

  let defaultValues: Partial<PlanEvent> | undefined;
  let action = createPlanEvent;
  let heading = "Add plan event";

  if (fromSuggestion) {
    const supabase = await createClient();
    const { data: suggestion } = await supabase
      .from("agent_suggestions")
      .select("*")
      .eq("id", fromSuggestion)
      .maybeSingle();

    if (suggestion) {
      defaultValues = {
        title: suggestion.title,
        type: suggestion.type,
        start_time: suggestion.start_time,
        end_time: suggestion.end_time,
        location: suggestion.location,
        intensity: suggestion.intensity,
        notes: suggestion.reason,
        distance: suggestion.distance,
        structure: suggestion.structure,
        pace_or_effort: suggestion.pace_or_effort,
        plan_reference: suggestion.plan_reference,
      };
      action = createPlanEventFromSuggestion.bind(null, fromSuggestion);
      heading = "Edit suggestion";
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{heading}</h1>
        <Link
          href="/"
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          ← Back to calendar
        </Link>
      </div>
      <PlanEventForm
        action={action}
        defaultValues={defaultValues}
        submitLabel={
          fromSuggestion ? "Save as plan event" : "Create plan event"
        }
      />
    </main>
  );
}
