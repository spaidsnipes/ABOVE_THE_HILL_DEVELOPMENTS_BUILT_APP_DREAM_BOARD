import { createHash, randomBytes } from "crypto";

export const PASSPORT_HANDOFF_TTL_SECONDS = 90;

export function createPassportHandoffCode() {
  return randomBytes(32).toString("base64url");
}

export function hashPassportHandoffCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function readBearer(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function passportHandoffConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && publishableKey && serviceRoleKey ? { url, publishableKey, serviceRoleKey } : null;
}
