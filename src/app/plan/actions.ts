"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createClient } from "@/utils/supabase/server";

function readPlanEventForm(formData: FormData) {
  const title = formData.get("title")?.toString().trim() ?? "";
  const startRaw = formData.get("start_time")?.toString() ?? "";
  const endRaw = formData.get("end_time")?.toString() ?? "";

  if (!title || !startRaw || !endRaw) {
    throw new Error("Title, start time, and end time are required.");
  }

  return {
    title,
    type: formData.get("type")?.toString() || null,
    start_time: new Date(startRaw).toISOString(),
    end_time: new Date(endRaw).toISOString(),
    location: formData.get("location")?.toString() || null,
    intensity: formData.get("intensity")?.toString() || null,
    status: formData.get("status")?.toString() || "planned",
    notes: formData.get("notes")?.toString() || null,
  };
}

export async function createPlanEvent(formData: FormData) {
  const session = await auth();
  const supabase = await createClient();
  const fields = readPlanEventForm(formData);

  const { error } = await supabase.from("plan_events").insert({
    ...fields,
    created_by: session?.user?.email ?? null,
  });

  if (error) {
    throw new Error(`Failed to create plan event: ${error.message}`);
  }

  revalidatePath("/");
  redirect("/");
}

export async function createPlanEventFromSuggestion(
  suggestionId: string,
  formData: FormData
) {
  const session = await auth();
  const supabase = await createClient();
  const fields = readPlanEventForm(formData);

  const { error: insertError } = await supabase.from("plan_events").insert({
    ...fields,
    created_by: session?.user?.email ?? null,
  });

  if (insertError) {
    throw new Error(`Failed to create plan event: ${insertError.message}`);
  }

  const { error: updateError } = await supabase
    .from("agent_suggestions")
    .update({ status: "edited" })
    .eq("id", suggestionId);

  if (updateError) {
    console.error("[Agent] Failed to mark suggestion as edited", updateError);
  }

  revalidatePath("/");
  redirect("/");
}

export async function updatePlanEvent(id: string, formData: FormData) {
  const supabase = await createClient();
  const fields = readPlanEventForm(formData);

  const { error } = await supabase
    .from("plan_events")
    .update(fields)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update plan event: ${error.message}`);
  }

  revalidatePath("/");
  redirect("/");
}

export async function deletePlanEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_events").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete plan event: ${error.message}`);
  }

  revalidatePath("/");
}
