/**
 * Public product identity (buyer-facing brand).
 * Pure module — no React dependency (safe for domain-adjacent shared config).
 *
 * The repository / project may still be called Marketplace Rawson;
 * this constant is the public name shown in the storefront.
 */
export const APP_NAME = "Pedilo";

export const APP_TAGLINE = "Pedí cerca en Rawson y Playa Unión";

export const APP_SERVICE_AREA = "Rawson · Playa Unión";

export function getFoundationStatusLabel(): string {
  return `${APP_NAME} — ${APP_TAGLINE}`;
}
