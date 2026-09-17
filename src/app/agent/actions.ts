"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createClient } from "@/utils/supabase/server";
import type { AgentSuggestion, PlanEvent } from "@/lib/planning";
import {
  checkSuggestionDuration,
  checkSuggestionPlacement,
} from "@/lib/agent/suggestionPlacement";

export interface SuggestionEditableFields {
  title?: string;
  type?: string | null;
  start_time?: string;
  end_time?: string;
  location?: string | null;
  intensity?: string | null;
  distance?: string | null;
  structure?: string;
  pace_or_effort?: string | null;
  plan_reference?: string;
  reason?: string;
  risk_warning?: string | null;
}

/**
 * Applies a drag, resize, or manual edit to a pending suggestion.
 * Validates against plan_events and other pending suggestions server-side
 * (authoritative); Google Calendar is checked client-side against
 * already-loaded data before this is called, since re-fetching it here on
 * every drag would add real latency for a low-risk race condition.
 */
export async function updateSuggestion(
  id: string,
  updates: SuggestionEditableFields
): Promise<AgentSuggestion> {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("agent_suggestions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !current) {
    throw new Error("Suggestion not found.");
  }
  if (current.status !== "pending") {
    throw new Error("Only pending suggestions can be edited.");
  }

  const nextStart = updates.start_time ?? current.start_time;
  const nextEnd = updates.end_time ?? current.end_time;
  const nextType = updates.type !== undefined ? updates.type : current.type;

  if (nextStart && nextEnd) {
    const start = new Date(nextStart);
    const end = new Date(nextEnd);

    const [{ data: otherPlan }, { data: otherSuggestions }] = await Promise.all([
      supabase.from("plan_events").select("start_time,end_time"),
      supabase
        .from("agent_suggestions")
        .select("id,start_time,end_time")
        .eq("status", "pending")
        .neq("id", id),
    ]);

    const placement = checkSuggestionPlacement({
      start,
      end,
      events: [],
      planEvents: (otherPlan ?? []) as Pick<PlanEvent, "start_time" | "end_time">[],
      suggestions: (otherSuggestions ?? []) as Pick<
        AgentSuggestion,
        "id" | "start_time" | "end_time"
      >[],
      excludeSuggestionId: id,
    });
    if (!placement.ok) {
      throw new Error(placement.message ?? "This time doesn't work.");
    }

    const minutes = (end.getTime() - start.getTime()) / 60000;
    const contextText = [
      updates.structure ?? current.structure,
      updates.reason ?? current.reason,
      updates.plan_reference ?? current.plan_reference,
    ]
      .filter(Boolean)
      .join(" ");
    const durationCheck = checkSuggestionDuration(nextType, minutes, contextText);
    if (!durationCheck.ok) {
      throw new Error(durationCheck.message ?? "That duration isn't realistic.");
    }
  }

  const payload: Record<string, unknown> = {
    ...updates,
    is_edited: true,
    edited_at: new Date().toISOString(),
  };
  if (!current.is_edited) {
    payload.original_start = current.start_time;
    payload.original_end = current.end_time;
  }

  const { data: updated, error: updateError } = await supabase
    .from("agent_suggestions")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(
      `Failed to save changes: ${updateError?.message ?? "unknown error"}`
    );
  }

  revalidatePath("/");
  return updated as AgentSuggestion;
}

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
    distance: suggestion.distance,
    structure: suggestion.structure,
    pace_or_effort: suggestion.pace_or_effort,
    plan_reference: suggestion.plan_reference,
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

/**
 * Removes only pending suggestions within [weekStartISO, weekEndISO). Never
 * touches plan_events (accepted/manual workouts) or any suggestion whose
 * status isn't 'pending' — Google Calendar has no write path in this app.
 */
export async function clearPendingSuggestions(
  weekStartISO: string,
  weekEndISO: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("agent_suggestions")
    .delete()
    .eq("status", "pending")
    .gte("start_time", weekStartISO)
    .lt("start_time", weekEndISO);

  if (error) {
    throw new Error(`Failed to clear suggestions: ${error.message}`);
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
