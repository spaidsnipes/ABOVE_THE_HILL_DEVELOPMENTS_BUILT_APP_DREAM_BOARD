export type WowWorldRoute = "lounge" | "shop" | "radio";

export const WOW_WORLD_ROUTES: readonly WowWorldRoute[] = ["lounge", "shop", "radio"] as const;

export function isWowWorldRoute(value: string): value is WowWorldRoute {
  return (WOW_WORLD_ROUTES as readonly string[]).includes(value);
}

/**
 * Dreamboard opens a WOW World surface without placing a Passport handle,
 * email, token, or creator content in the URL.  A future shared-auth bridge
 * must be an explicit, server-verified consent flow.
 */
export function wowWorldDestination(origin: string, route: WowWorldRoute): string {
  return `${origin.replace(/\/$/, "")}/${route}`;
}

export const WOW_WORLD_BRIDGE_BOUNDARY = "The embedded surface never receives Passport identity or private Dreamboard material. Connect Passport opens a separate, one-time secure handoff instead.";
