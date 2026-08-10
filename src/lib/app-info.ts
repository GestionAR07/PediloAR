/**
 * Application identity used by the technical foundation UI.
 * Pure module — no React dependency (safe for domain-adjacent shared config).
 */
export const APP_NAME = "Marketplace Rawson";

export const APP_TAGLINE = "Base técnica operativa";

export const APP_SERVICE_AREA = "Rawson · Playa Unión";

export function getFoundationStatusLabel(): string {
  return `${APP_NAME} — ${APP_TAGLINE}`;
}
