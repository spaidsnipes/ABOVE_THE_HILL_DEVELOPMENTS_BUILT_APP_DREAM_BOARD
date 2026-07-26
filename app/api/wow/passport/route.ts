import { createPassportHandoffCode, hashPassportHandoffCode, passportHandoffConfig, readBearer, PASSPORT_HANDOFF_TTL_SECONDS } from "../../../../lib/passport-handoff";
import { isWowWorldRoute } from "../../../../lib/wow-bridge";

type AuthUser = { id?: string };

export async function POST(request: Request) {
  const config = passportHandoffConfig();
  if (!config) {
    return Response.json({ error: "WOW World Passport handoff is not configured on this server yet." }, { status: 503 });
  }

  const bearer = readBearer(request);
  if (!bearer) return Response.json({ error: "Sign in to Dreamboard before connecting Passport." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { route?: string };
  if (!body.route || !isWowWorldRoute(body.route)) return Response.json({ error: "Choose a valid WOW World destination." }, { status: 400 });

  const identityResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });
  const identity = await identityResponse.json().catch(() => ({})) as AuthUser;
  if (!identityResponse.ok || !identity.id) return Response.json({ error: "Dreamboard could not verify this Passport session." }, { status: 401 });

  const code = createPassportHandoffCode();
  const expiresAt = new Date(Date.now() + PASSPORT_HANDOFF_TTL_SECONDS * 1000).toISOString();
  const createResponse = await fetch(`${config.url}/rest/v1/dreamboard_passport_handoffs`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ user_id: identity.id, destination: body.route, code_hash: hashPassportHandoffCode(code), expires_at: expiresAt }),
    cache: "no-store",
  });
  if (!createResponse.ok) return Response.json({ error: "Dreamboard could not create the one-time Passport handoff." }, { status: 503 });

  return Response.json({ code, route: body.route, expiresAt }, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
