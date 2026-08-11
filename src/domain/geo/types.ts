import type { CityId, ProvinceId, ZoneId } from "../shared/ids";

/**
 * Geography hierarchy: Province → City → Zone.
 * Pilot data (Chubut / Rawson / Playa Unión) lives in seed/config later — not in domain rules.
 */
export type Province = {
  id: ProvinceId;
  name: string;
  /** Short administrative or URL-friendly code (e.g. "CHUBUT"). */
  code: string;
};

export type City = {
  id: CityId;
  provinceId: ProvinceId;
  name: string;
  slug: string;
  /** IANA timezone, e.g. America/Argentina/Catamarca for Rawson later. */
  timezone: string;
};

export type Zone = {
  id: ZoneId;
  cityId: CityId;
  name: string;
  slug: string;
};
