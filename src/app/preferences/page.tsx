import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { savePreferences } from "./actions";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-slate-700";

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const supabase = await createClient();
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("*")
    .limit(1)
    .maybeSingle();

  const { saved } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          Training Preferences
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Back to calendar
        </Link>
      </div>

      {saved === "1" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Preferences saved.
        </div>
      )}

      <form action={savePreferences} className="space-y-4">
        {preferences?.id && (
          <input type="hidden" name="id" defaultValue={preferences.id} />
        )}

        <label className="block">
          <span className={LABEL_CLASS}>Race goal</span>
          <input
            name="race_goal"
            placeholder="e.g. Ironman 70.3 Marbella"
            defaultValue={preferences?.race_goal ?? ""}
            className={INPUT_CLASS}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={LABEL_CLASS}>Race date</span>
            <input
              type="date"
              name="race_date"
              defaultValue={preferences?.race_date ?? ""}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Weekly training hours</span>
            <input
              type="number"
              step="0.5"
              min="0"
              name="weekly_training_hours"
              defaultValue={preferences?.weekly_training_hours ?? ""}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL_CLASS}>Preferred training times</span>
          <textarea
            name="preferred_training_times"
            rows={2}
            placeholder="e.g. Weekday mornings before 8am, Saturday long sessions"
            defaultValue={preferences?.preferred_training_times ?? ""}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Times to avoid</span>
          <textarea
            name="avoid_times"
            rows={2}
            placeholder="e.g. No training during lectures, avoid late nights before exams"
            defaultValue={preferences?.avoid_times ?? ""}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Location notes</span>
          <textarea
            name="location_notes"
            rows={2}
            placeholder="e.g. Pool access at LBS gym, usual bike route starts from home"
            defaultValue={preferences?.location_notes ?? ""}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Recovery notes</span>
          <textarea
            name="recovery_notes"
            rows={2}
            placeholder="e.g. Old knee injury, needs a rest day after long runs"
            defaultValue={preferences?.recovery_notes ?? ""}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>
            Anything else worth remembering
          </span>
          <textarea
            name="free_text_memory"
            rows={4}
            defaultValue={preferences?.free_text_memory ?? ""}
            className={INPUT_CLASS}
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Save preferences
        </button>
      </form>
    </main>
  );
}
