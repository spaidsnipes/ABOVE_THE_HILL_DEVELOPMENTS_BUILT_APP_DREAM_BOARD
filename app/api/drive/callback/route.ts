import { cookie, getDriveConfig, readCookie } from "../lib";

type TokenResponse = { access_token?: string; expires_in?: number; error_description?: string };

export async function GET(request: Request) {
  const config = getDriveConfig();
  const url = new URL(request.url);
  const redirectHome = (flag: string) => new Response(null, { status: 302, headers: { Location: `/?drive=${flag}` } });
  if (!config) return redirectHome("not-configured");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, "dreamboard_drive_state");
  if (!code || !state || !expectedState || state !== expectedState) return redirectHome("error");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }),
    });
    const token = await tokenResponse.json() as TokenResponse;
    if (!tokenResponse.ok || !token.access_token) return redirectHome("error");
    const maxAge = Math.max(60, Math.min(token.expires_in || 3600, 3600) - 60);
    const headers = new Headers({ Location: "/?drive=connected" });
    headers.append("Set-Cookie", cookie("dreamboard_drive_token", token.access_token, maxAge));
    headers.append("Set-Cookie", cookie("dreamboard_drive_state", "", 0));
    return new Response(null, { status: 302, headers });
  } catch {
    return redirectHome("error");
  }
}
