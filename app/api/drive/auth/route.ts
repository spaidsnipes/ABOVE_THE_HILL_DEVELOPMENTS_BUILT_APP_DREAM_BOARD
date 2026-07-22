import { DRIVE_SCOPE, cookie, getDriveConfig, notConfigured } from "../lib";

// Starts the OAuth consent flow. Access is read-only and the token is held in
// an HttpOnly cookie for the session — Dreamboard never stores Drive
// credentials in its database.
export async function GET() {
  const config = getDriveConfig();
  if (!config) return notConfigured();
  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), "Set-Cookie": cookie("dreamboard_drive_state", state, 600) },
  });
}
