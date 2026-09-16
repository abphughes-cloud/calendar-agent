import { readFile } from "fs/promises";
import path from "path";

const CONTEXT_FILE_PATH = path.join(
  process.cwd(),
  "context",
  "athlete_training_context.md"
);

/**
 * Loads the athlete's personal training context file (logistics, race
 * plan, injury constraints, scheduling rules). Server-only - never sent
 * to the client. This is a local, gitignored file; if it's missing,
 * suggestions still generate, just without this extra context.
 */
export async function loadAthleteContext(): Promise<string | null> {
  try {
    const content = await readFile(CONTEXT_FILE_PATH, "utf8");
    const trimmed = content.trim();
    if (!trimmed) {
      console.warn(`[Agent] ${CONTEXT_FILE_PATH} is empty; ignoring.`);
      return null;
    }
    console.log(
      `[Agent] Loaded athlete training context from ${CONTEXT_FILE_PATH} (${trimmed.length} chars)`
    );
    return trimmed;
  } catch (error) {
    console.warn(
      `[Agent] No athlete training context file found at ${CONTEXT_FILE_PATH}; generating suggestions without it.`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
