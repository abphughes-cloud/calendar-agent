"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function savePreferences(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString() || undefined;
  const weeklyHoursRaw = formData.get("weekly_training_hours")?.toString();

  const payload = {
    race_goal: formData.get("race_goal")?.toString() || null,
    race_date: formData.get("race_date")?.toString() || null,
    weekly_training_hours: weeklyHoursRaw ? Number(weeklyHoursRaw) : null,
    preferred_training_times:
      formData.get("preferred_training_times")?.toString() || null,
    avoid_times: formData.get("avoid_times")?.toString() || null,
    location_notes: formData.get("location_notes")?.toString() || null,
    recovery_notes: formData.get("recovery_notes")?.toString() || null,
    free_text_memory: formData.get("free_text_memory")?.toString() || null,
  };

  const { error } = id
    ? await supabase.from("user_preferences").update(payload).eq("id", id)
    : await supabase.from("user_preferences").insert(payload);

  if (error) {
    throw new Error(`Failed to save preferences: ${error.message}`);
  }

  revalidatePath("/preferences");
  redirect("/preferences?saved=1");
}
