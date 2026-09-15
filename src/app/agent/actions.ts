"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createClient } from "@/utils/supabase/server";
import type { AgentSuggestion } from "@/lib/planning";

export async function acceptSuggestion(suggestion: AgentSuggestion) {
  if (!suggestion.start_time || !suggestion.end_time) {
    throw new Error("Suggestion is missing a start or end time.");
  }

  const session = await auth();
  const supabase = await createClient();

  const { error: insertError } = await supabase.from("plan_events").insert({
    title: suggestion.title,
    type: suggestion.type,
    start_time: suggestion.start_time,
    end_time: suggestion.end_time,
    location: suggestion.location,
    intensity: suggestion.intensity,
    status: "planned",
    notes: suggestion.reason,
    created_by: session?.user?.email ?? null,
  });

  if (insertError) {
    throw new Error(`Failed to create plan event: ${insertError.message}`);
  }

  const { error: updateError } = await supabase
    .from("agent_suggestions")
    .update({ status: "accepted" })
    .eq("id", suggestion.id);

  if (updateError) {
    throw new Error(`Failed to update suggestion: ${updateError.message}`);
  }

  revalidatePath("/");
}

export async function rejectSuggestion(id: string, feedbackText?: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("agent_suggestions")
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update suggestion: ${error.message}`);
  }

  const trimmedFeedback = feedbackText?.trim();
  if (trimmedFeedback) {
    const { error: feedbackError } = await supabase.from("feedback").insert({
      suggestion_id: id,
      action: "rejected",
      feedback_text: trimmedFeedback,
    });
    if (feedbackError) {
      console.error("[Agent] Failed to save feedback", feedbackError);
    }
  }

  revalidatePath("/");
}
