export const PUBLIC_ZONE_STORAGE_KEY = "mr.public.zoneId";

export function readPublicZoneId(
  storage: Pick<Storage, "getItem"> | null | undefined,
): string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(PUBLIC_ZONE_STORAGE_KEY)?.trim() ?? "";
    return value || null;
  } catch {
    return null;
  }
}

export function writePublicZoneId(
  storage: Pick<Storage, "setItem"> | null | undefined,
  zoneId: string,
): void {
  if (!storage) return;
  try {
    storage.setItem(PUBLIC_ZONE_STORAGE_KEY, zoneId);
  } catch {
    // ignore storage failures
  }
}
