export interface UserPreferences {
  id: string;
  race_goal: string | null;
  race_date: string | null;
  weekly_training_hours: number | null;
  preferred_training_times: string | null;
  avoid_times: string | null;
  location_notes: string | null;
  recovery_notes: string | null;
  free_text_memory: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanEvent {
  id: string;
  title: string;
  type: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  intensity: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  distance: string | null;
  structure: string | null;
  pace_or_effort: string | null;
  plan_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSuggestion {
  id: string;
  title: string;
  type: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  intensity: string | null;
  reason: string | null;
  distance: string | null;
  structure: string | null;
  pace_or_effort: string | null;
  plan_reference: string | null;
  risk_warning: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export const PLAN_EVENT_TYPES = [
  "Swim",
  "Bike",
  "Run",
  "Brick",
  "Strength",
  "Study",
  "Social",
  "Other",
] as const;

export const PLAN_EVENT_INTENSITIES = ["Low", "Medium", "High"] as const;

export const PLAN_EVENT_STATUSES = [
  "planned",
  "confirmed",
  "completed",
  "cancelled",
] as const;
