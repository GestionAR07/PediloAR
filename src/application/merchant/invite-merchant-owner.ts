import { err, ok, type Result } from "@/domain/shared/result";
import { isValidEmailFormat, normalizeEmail } from "@/lib/email";
import type { ApplicationError } from "../geography/write-geography";

export type InviteMerchantOwnerInput = {
  merchantId: string;
  email: string;
  displayName?: string;
};

export type AuthUserSnapshot = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
};

export type MembershipSnapshot = {
  role: "OWNER" | "STAFF" | string;
  active: boolean;
};

export type InviteMerchantOwnerOutcome =
  | {
      kind: "INVITED_NEW_USER";
      userId: string;
      message: string;
    }
  | {
      kind: "ASSIGNED_EXISTING_CONFIRMED";
      userId: string;
      message: string;
    }
  | {
      kind: "ASSIGNED_EXISTING_PENDING";
      userId: string;
      message: string;
    }
  | {
      kind: "ALREADY_OWNER";
      userId: string;
      message: string;
    };

export type InviteMerchantOwnerDeps = {
  requirePlatformAdmin: () => Promise<void>;
  findMerchantById: (id: string) => Promise<{ id: string } | null>;
  findAuthUserByEmail: (email: string) => Promise<AuthUserSnapshot | null>;
  inviteAuthUser: (input: {
    email: string;
    displayName?: string;
    redirectTo: string;
  }) => Promise<AuthUserSnapshot>;
  ensureUserProfile: (input: {
    userId: string;
    displayName?: string | null;
  }) => Promise<void>;
  findMembership: (
    merchantId: string,
    userId: string,
  ) => Promise<MembershipSnapshot | null>;
  insertOwnerMembership: (input: {
    merchantId: string;
    userId: string;
  }) => Promise<void>;
  getInviteRedirectTo: () => string;
  secretConfigured: () => boolean;
};

/**
 * Invites / assigns a merchant OWNER.
 *
 * Authorization is always via requirePlatformAdmin (not the secret key).
 * Membership OWNER is the sole source of merchant authority.
 */
export async function inviteMerchantOwner(
  input: InviteMerchantOwnerInput,
  deps: InviteMerchantOwnerDeps,
): Promise<Result<InviteMerchantOwnerOutcome, ApplicationError>> {
  await deps.requirePlatformAdmin();

  if (!deps.secretConfigured()) {
    return err({
      code: "SECRET_MISSING",
      message:
        "Falta la configuración del servidor para invitaciones (SUPABASE_SECRET_KEY).",
    });
  }

  const merchantId = input.merchantId.trim();
  const email = normalizeEmail(input.email);
  const displayName = input.displayName?.trim() || undefined;

  if (!merchantId) {
    return err({
      code: "INVALID_MERCHANT",
      message: "Comercio inválido.",
    });
  }

  if (!isValidEmailFormat(email)) {
    return err({
      code: "INVALID_EMAIL",
      message: "El email no es válido.",
    });
  }

  const merchant = await deps.findMerchantById(merchantId);
  if (!merchant) {
    return err({
      code: "MERCHANT_NOT_FOUND",
      message: "El comercio no existe.",
    });
  }

  let authUser = await deps.findAuthUserByEmail(email);
  let flow: "new" | "confirmed" | "pending";

  if (!authUser) {
    try {
      authUser = await deps.inviteAuthUser({
        email,
        displayName,
        redirectTo: deps.getInviteRedirectTo(),
      });
      flow = "new";
    } catch {
      return err({
        code: "INVITE_FAILED",
        message:
          "No se pudo enviar la invitación. Reintentá más tarde o revisá la configuración de Auth.",
      });
    }
  } else if (authUser.emailConfirmed) {
    flow = "confirmed";
  } else {
    flow = "pending";
  }

  try {
    await deps.ensureUserProfile({
      userId: authUser.id,
      displayName: displayName ?? null,
    });
  } catch {
    return err({
      code: "PROFILE_MISSING",
      message:
        "La invitación de Auth se procesó, pero el perfil aún no está disponible. Reintentá en unos segundos.",
    });
  }

  const existing = await deps.findMembership(merchantId, authUser.id);
  if (existing) {
    if (existing.role === "OWNER") {
      return ok({
        kind: "ALREADY_OWNER",
        userId: authUser.id,
        message: "Este usuario ya es propietario del comercio.",
      });
    }
    if (existing.role === "STAFF") {
      return err({
        code: "STAFF_CONFLICT",
        message:
          "Este usuario ya es STAFF de este comercio. No se eleva a OWNER desde invitar propietario.",
      });
    }
    return err({
      code: "MEMBERSHIP_CONFLICT",
      message: "Este usuario ya tiene un rol en el comercio.",
    });
  }

  try {
    await deps.insertOwnerMembership({
      merchantId,
      userId: authUser.id,
    });
  } catch {
    // Idempotent retry path: re-read
    const again = await deps.findMembership(merchantId, authUser.id);
    if (again?.role === "OWNER") {
      return ok({
        kind: "ALREADY_OWNER",
        userId: authUser.id,
        message: "Este usuario ya es propietario del comercio.",
      });
    }
    if (again?.role === "STAFF") {
      return err({
        code: "STAFF_CONFLICT",
        message:
          "Este usuario ya es STAFF de este comercio. No se eleva a OWNER desde invitar propietario.",
      });
    }
    return err({
      code: "MEMBERSHIP_FAILED",
      message:
        "No se pudo asignar la membresía OWNER. Reintentá: el usuario de Auth no se elimina para permitir recuperación.",
    });
  }

  if (flow === "new") {
    return ok({
      kind: "INVITED_NEW_USER",
      userId: authUser.id,
      message:
        "Invitación enviada. El propietario debe confirmar el email y establecer contraseña.",
    });
  }

  if (flow === "pending") {
    return ok({
      kind: "ASSIGNED_EXISTING_PENDING",
      userId: authUser.id,
      message:
        "El usuario ya tiene una invitación/cuenta pendiente de confirmar. Se asignó como propietario.",
    });
  }

  return ok({
    kind: "ASSIGNED_EXISTING_CONFIRMED",
    userId: authUser.id,
    message: "Usuario existente asignado como propietario.",
  });
}
