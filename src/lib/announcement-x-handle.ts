const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
export const announcementXHandleError = "Enter an X handle using 1–15 letters, numbers, or underscores, with an optional @. Do not enter a URL.";

/** Explicit opt-in only: undefined/blank is absence; null and wrong types are errors. */
export function normalizeAnnouncementXHandle(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(announcementXHandleError);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const handle = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!HANDLE_PATTERN.test(handle)) throw new Error(announcementXHandleError);
  return handle;
}

export function buildSubmissionPrompt(value?: unknown): string {
  const handle = normalizeAnnouncementXHandle(value);
  const prompt = "Read https://agentfirst.directory/SKILL.md to add a new tool";
  return handle
    ? `${prompt} I explicitly supplied this X handle to tag when announcing the listing. Preserve it in the content PR tool frontmatter as announcementXHandle: "${handle}". This is separate from GitHub attribution; never infer or scrape a handle.`
    : prompt;
}
