// Shared helpers for the Google Drive connector routes.
// Configuration lives in three env vars; nothing is simulated without them.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export type DriveConfig = { clientId: string; clientSecret: string; redirectUri: string };

export function getDriveConfig(): DriveConfig | null {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null;
}

export function notConfigured(): Response {
  return Response.json({
    configured: false,
    error: "Google Drive import is built but not linked yet. Set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REDIRECT_URI in the hosted environment.",
  }, { status: 503 });
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(/;\s*/)) {
    const [key, ...rest] = part.split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
