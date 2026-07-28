export type PassportRedirect =
  | { kind: "exchange"; code: string }
  | { kind: "ready" }
  | { kind: "error"; message: string }
  | { kind: "none" };

/**
 * Interprets only the public, short-lived values Supabase places in the
 * callback URL. Access tokens are never read from or retained in app code.
 */
export function readPassportRedirect(search: string): PassportRedirect {
  const params = new URLSearchParams(search);
  const error = params.get("error_description") || params.get("error");
  if (error) return { kind: "error", message: error };
  const code = params.get("code")?.trim();
  if (code) return { kind: "exchange", code };
  if (params.get("passport") === "ready") return { kind: "ready" };
  return { kind: "none" };
}

/** Removes callback-only values without touching a creator's intended view. */
export function cleanPassportRedirect(search: string) {
  const params = new URLSearchParams(search);
  for (const key of ["code", "error", "error_code", "error_description", "passport"]) params.delete(key);
  const remaining = params.toString();
  return remaining ? `?${remaining}` : "";
}
