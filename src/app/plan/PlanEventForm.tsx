import {
  PLAN_EVENT_INTENSITIES,
  PLAN_EVENT_STATUSES,
  PLAN_EVENT_TYPES,
  type PlanEvent,
} from "@/lib/planning";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function PlanEventForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: Partial<PlanEvent>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className={LABEL_CLASS}>Title</span>
        <input
          required
          name="title"
          defaultValue={defaultValues?.title ?? ""}
          className={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL_CLASS}>Type</span>
          <select
            name="type"
            defaultValue={defaultValues?.type ?? PLAN_EVENT_TYPES[0]}
            className={INPUT_CLASS}
          >
            {PLAN_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>Intensity</span>
          <select
            name="intensity"
            defaultValue={defaultValues?.intensity ?? PLAN_EVENT_INTENSITIES[1]}
            className={INPUT_CLASS}
          >
            {PLAN_EVENT_INTENSITIES.map((intensity) => (
              <option key={intensity} value={intensity}>
                {intensity}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL_CLASS}>Start</span>
          <input
            required
            type="datetime-local"
            name="start_time"
            defaultValue={
              defaultValues?.start_time
                ? toLocalInputValue(defaultValues.start_time)
                : ""
            }
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>End</span>
          <input
            required
            type="datetime-local"
            name="end_time"
            defaultValue={
              defaultValues?.end_time
                ? toLocalInputValue(defaultValues.end_time)
                : ""
            }
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="block">
        <span className={LABEL_CLASS}>Location</span>
        <input
          name="location"
          defaultValue={defaultValues?.location ?? ""}
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Status</span>
        <select
          name="status"
          defaultValue={defaultValues?.status ?? PLAN_EVENT_STATUSES[0]}
          className={INPUT_CLASS}
        >
          {PLAN_EVENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
          className={INPUT_CLASS}
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}
