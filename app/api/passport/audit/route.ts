import { passportHandoffConfig, readBearer } from "../../../../lib/passport-handoff";

type AuthUser = { id?: string };

export async function GET(request: Request) {
  const config = passportHandoffConfig();
  if (!config) return Response.json({ error: "Passport audit is not configured yet." }, { status: 503 });
  const bearer = readBearer(request);
  if (!bearer) return Response.json({ error: "Sign in before viewing Passport activity." }, { status: 401 });

  const identityResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });
  const identity = await identityResponse.json().catch(() => ({})) as AuthUser;
  if (!identityResponse.ok || !identity.id) return Response.json({ error: "Dreamboard could not verify this Passport session." }, { status: 401 });

  const activityResponse = await fetch(`${config.url}/rest/v1/dreamboard_passport_audit_events?user_id=eq.${encodeURIComponent(identity.id)}&select=id,event_type,detail,created_at&order=created_at.desc&limit=20`, {
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` },
    cache: "no-store",
  });
  if (!activityResponse.ok) return Response.json({ error: "Passport activity is not available yet." }, { status: 503 });
  return Response.json({ events: await activityResponse.json() }, { headers: { "Cache-Control": "no-store" } });
}
