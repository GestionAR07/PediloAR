import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { cities, provinces, zones } from "../schema";

export type ProvinceRecord = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
};

export type CityRecord = {
  id: string;
  provinceId: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: Date;
};

export type ZoneRecord = {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  createdAt: Date;
};

export type CityWithProvince = CityRecord & {
  provinceName: string;
  provinceCode: string;
};

export type ZoneWithCity = ZoneRecord & {
  cityName: string;
};

export async function listProvinces(): Promise<ProvinceRecord[]> {
  const db = getDb();
  return db
    .select({
      id: provinces.id,
      name: provinces.name,
      code: provinces.code,
      createdAt: provinces.createdAt,
    })
    .from(provinces)
    .orderBy(asc(provinces.name));
}

export async function listCities(): Promise<CityWithProvince[]> {
  const db = getDb();
  return db
    .select({
      id: cities.id,
      provinceId: cities.provinceId,
      name: cities.name,
      slug: cities.slug,
      timezone: cities.timezone,
      createdAt: cities.createdAt,
      provinceName: provinces.name,
      provinceCode: provinces.code,
    })
    .from(cities)
    .innerJoin(provinces, eq(provinces.id, cities.provinceId))
    .orderBy(asc(cities.name));
}

export async function listZones(): Promise<ZoneWithCity[]> {
  const db = getDb();
  return db
    .select({
      id: zones.id,
      cityId: zones.cityId,
      name: zones.name,
      slug: zones.slug,
      createdAt: zones.createdAt,
      cityName: cities.name,
    })
    .from(zones)
    .innerJoin(cities, eq(cities.id, zones.cityId))
    .orderBy(asc(zones.name));
}

export async function listZonesByCityId(
  cityId: string,
): Promise<ZoneWithCity[]> {
  const db = getDb();
  return db
    .select({
      id: zones.id,
      cityId: zones.cityId,
      name: zones.name,
      slug: zones.slug,
      createdAt: zones.createdAt,
      cityName: cities.name,
    })
    .from(zones)
    .innerJoin(cities, eq(cities.id, zones.cityId))
    .where(eq(zones.cityId, cityId))
    .orderBy(asc(zones.name));
}

export async function findProvinceById(
  id: string,
): Promise<ProvinceRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: provinces.id,
      name: provinces.name,
      code: provinces.code,
      createdAt: provinces.createdAt,
    })
    .from(provinces)
    .where(eq(provinces.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findCityById(id: string): Promise<CityRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: cities.id,
      provinceId: cities.provinceId,
      name: cities.name,
      slug: cities.slug,
      timezone: cities.timezone,
      createdAt: cities.createdAt,
    })
    .from(cities)
    .where(eq(cities.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findZoneById(id: string): Promise<ZoneRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: zones.id,
      cityId: zones.cityId,
      name: zones.name,
      slug: zones.slug,
      createdAt: zones.createdAt,
    })
    .from(zones)
    .where(eq(zones.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertProvince(input: {
  name: string;
  code: string;
}): Promise<ProvinceRecord> {
  const db = getDb();
  const rows = await db
    .insert(provinces)
    .values({
      name: input.name,
      code: input.code,
    })
    .returning({
      id: provinces.id,
      name: provinces.name,
      code: provinces.code,
      createdAt: provinces.createdAt,
    });
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert province");
  }
  return row;
}

export async function insertCity(input: {
  provinceId: string;
  name: string;
  slug: string;
  timezone: string;
}): Promise<CityRecord> {
  const db = getDb();
  const rows = await db
    .insert(cities)
    .values({
      provinceId: input.provinceId,
      name: input.name,
      slug: input.slug,
      timezone: input.timezone,
    })
    .returning({
      id: cities.id,
      provinceId: cities.provinceId,
      name: cities.name,
      slug: cities.slug,
      timezone: cities.timezone,
      createdAt: cities.createdAt,
    });
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert city");
  }
  return row;
}

export async function insertZone(input: {
  cityId: string;
  name: string;
  slug: string;
}): Promise<ZoneRecord> {
  const db = getDb();
  const rows = await db
    .insert(zones)
    .values({
      cityId: input.cityId,
      name: input.name,
      slug: input.slug,
    })
    .returning({
      id: zones.id,
      cityId: zones.cityId,
      name: zones.name,
      slug: zones.slug,
      createdAt: zones.createdAt,
    });
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert zone");
  }
  return row;
}
