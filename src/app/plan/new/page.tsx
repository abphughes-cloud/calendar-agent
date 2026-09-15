import Link from "next/link";
import PlanEventForm from "../PlanEventForm";
import { createPlanEvent } from "../actions";

export default function NewPlanEventPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          Add plan event
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          ← Back to calendar
        </Link>
      </div>
      <PlanEventForm action={createPlanEvent} submitLabel="Create plan event" />
    </main>
  );
}
