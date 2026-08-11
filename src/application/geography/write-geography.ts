import { err, ok, type Result } from "@/domain/shared/result";
import { isValidSlug, normalizeSlug } from "@/lib/slug";
import { isValidIanaTimezone } from "@/lib/timezone";

export type ApplicationError = {
  code: string;
  message: string;
};

export type CreateProvinceInput = {
  name: string;
  code: string;
};

export type CreateCityInput = {
  provinceId: string;
  name: string;
  slug: string;
  timezone: string;
};

export type CreateZoneInput = {
  cityId: string;
  name: string;
  slug: string;
};

export type GeographyWriteDeps = {
  requirePlatformAdmin: () => Promise<void>;
  findProvinceById: (id: string) => Promise<{ id: string } | null>;
  findCityById: (
    id: string,
  ) => Promise<{ id: string; provinceId: string } | null>;
  insertProvince: (input: {
    name: string;
    code: string;
  }) => Promise<{ id: string; name: string; code: string }>;
  insertCity: (input: {
    provinceId: string;
    name: string;
    slug: string;
    timezone: string;
  }) => Promise<{ id: string }>;
  insertZone: (input: {
    cityId: string;
    name: string;
    slug: string;
  }) => Promise<{ id: string }>;
  isUniqueViolation: (error: unknown) => boolean;
};

function blank(value: string): boolean {
  return value.trim().length === 0;
}

export async function createProvince(
  input: CreateProvinceInput,
  deps: GeographyWriteDeps,
): Promise<Result<{ id: string }, ApplicationError>> {
  await deps.requirePlatformAdmin();

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();

  if (blank(name)) {
    return err({ code: "INVALID_NAME", message: "El nombre es obligatorio." });
  }
  if (blank(code)) {
    return err({ code: "INVALID_CODE", message: "El código es obligatorio." });
  }
  if (code.length > 32) {
    return err({
      code: "INVALID_CODE",
      message: "El código es demasiado largo.",
    });
  }

  try {
    const row = await deps.insertProvince({ name, code });
    return ok({ id: row.id });
  } catch (error) {
    if (deps.isUniqueViolation(error)) {
      return err({
        code: "DUPLICATE_CODE",
        message: "Ya existe una provincia con ese código.",
      });
    }
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo crear la provincia.",
    });
  }
}

export async function createCity(
  input: CreateCityInput,
  deps: GeographyWriteDeps,
): Promise<Result<{ id: string }, ApplicationError>> {
  await deps.requirePlatformAdmin();

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const timezone = input.timezone.trim();
  const provinceId = input.provinceId.trim();

  if (!provinceId) {
    return err({
      code: "INVALID_PROVINCE",
      message: "Seleccioná una provincia.",
    });
  }
  if (blank(name)) {
    return err({ code: "INVALID_NAME", message: "El nombre es obligatorio." });
  }
  if (!isValidSlug(slug)) {
    return err({
      code: "INVALID_SLUG",
      message: "El slug no es válido (minúsculas, números y guiones).",
    });
  }
  if (!isValidIanaTimezone(timezone)) {
    return err({
      code: "INVALID_TIMEZONE",
      message: "Timezone IANA inválida (ej. America/Argentina/Catamarca).",
    });
  }

  const province = await deps.findProvinceById(provinceId);
  if (!province) {
    return err({
      code: "PROVINCE_NOT_FOUND",
      message: "La provincia seleccionada no existe.",
    });
  }

  try {
    const row = await deps.insertCity({ provinceId, name, slug, timezone });
    return ok({ id: row.id });
  } catch (error) {
    if (deps.isUniqueViolation(error)) {
      return err({
        code: "DUPLICATE_SLUG",
        message: "Ya existe una ciudad con ese slug en la provincia.",
      });
    }
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo crear la ciudad.",
    });
  }
}

export async function createZone(
  input: CreateZoneInput,
  deps: GeographyWriteDeps,
): Promise<Result<{ id: string }, ApplicationError>> {
  await deps.requirePlatformAdmin();

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const cityId = input.cityId.trim();

  if (!cityId) {
    return err({ code: "INVALID_CITY", message: "Seleccioná una ciudad." });
  }
  if (blank(name)) {
    return err({ code: "INVALID_NAME", message: "El nombre es obligatorio." });
  }
  if (!isValidSlug(slug)) {
    return err({
      code: "INVALID_SLUG",
      message: "El slug no es válido (minúsculas, números y guiones).",
    });
  }

  const city = await deps.findCityById(cityId);
  if (!city) {
    return err({
      code: "CITY_NOT_FOUND",
      message: "La ciudad seleccionada no existe.",
    });
  }

  try {
    const row = await deps.insertZone({ cityId, name, slug });
    return ok({ id: row.id });
  } catch (error) {
    if (deps.isUniqueViolation(error)) {
      return err({
        code: "DUPLICATE_SLUG",
        message: "Ya existe una zona con ese slug en la ciudad.",
      });
    }
    return err({
      code: "WRITE_FAILED",
      message: "No se pudo crear la zona.",
    });
  }
}
