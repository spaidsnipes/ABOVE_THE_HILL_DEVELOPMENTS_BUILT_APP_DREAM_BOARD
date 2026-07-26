export type WowWorldRoute = "lounge" | "shop" | "radio";

/**
 * Dreamboard opens a WOW World surface without placing a Passport handle,
 * email, token, or creator content in the URL.  A future shared-auth bridge
 * must be an explicit, server-verified consent flow.
 */
export function wowWorldDestination(origin: string, route: WowWorldRoute): string {
  return `${origin.replace(/\/$/, "")}/${route}`;
}

export const WOW_WORLD_BRIDGE_BOUNDARY = "Opening WOW World does not transfer Passport identity or private Dreamboard material.";
