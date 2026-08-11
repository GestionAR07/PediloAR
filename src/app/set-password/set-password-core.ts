/**
 * Pure-ish set-password flow (no Next redirects).
 * Used by the Server Action and unit tests.
 */

export type SetPasswordFields = {
  password: string;
  confirm: string;
};

export type SetPasswordValidationError = {
  ok: false;
  error: string;
};

export type SetPasswordValidationOk = {
  ok: true;
  password: string;
};

export type SetPasswordValidationResult =
  SetPasswordValidationOk | SetPasswordValidationError;

/** Validate passwords without mutating them (no trim). */
export function validateSetPasswordFields(
  fields: SetPasswordFields,
): SetPasswordValidationResult {
  const { password, confirm } = fields;

  if (!password || !confirm) {
    return { ok: false, error: "Completá ambos campos de contraseña." };
  }

  if (password !== confirm) {
    return { ok: false, error: "Las contraseñas no coinciden." };
  }

  if (password.length < 8) {
    return {
      ok: false,
      error: "La contraseña debe tener al menos 8 caracteres.",
    };
  }

  if (password.length > 72) {
    return { ok: false, error: "La contraseña es demasiado larga." };
  }

  return { ok: true, password };
}

export type UserScopedAuthClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message: string } | null;
    }>;
    getSession: () => Promise<{
      data: {
        session: {
          access_token: string;
          refresh_token: string;
        } | null;
      };
      error: { message: string } | null;
    }>;
    setSession: (tokens: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{ error: { message: string } | null }>;
    updateUser: (attributes: { password: string }) => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

export type PersistPasswordResult =
  { ok: true } | { ok: false; error: string; unauthenticated?: boolean };

/**
 * Persists password for the authenticated user via user-scoped updateUser,
 * then proves signInWithPassword accepts that exact password before success.
 */
export async function persistInvitedUserPassword(
  supabase: UserScopedAuthClient,
  password: string,
): Promise<PersistPasswordResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      unauthenticated: true,
      error: "Sesión inválida.",
    };
  }

  const email = user.email?.trim();
  if (!email) {
    return {
      ok: false,
      error: "Tu cuenta no tiene un email asociado.",
    };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token || !session.refresh_token) {
    return {
      ok: false,
      error:
        "No hay una sesión válida para actualizar la contraseña. Volvé a abrir el enlace de invitación.",
    };
  }

  // Re-bind session explicitly — SSR cookie clients can validate getUser()
  // while leaving updateUser without a usable in-memory session.
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setSessionError) {
    return {
      ok: false,
      error:
        "No se pudo revalidar la sesión. Volvé a abrir el enlace de invitación.",
    };
  }

  const { data: updated, error: updateError } = await supabase.auth.updateUser({
    password,
  });

  if (updateError || !updated.user) {
    return {
      ok: false,
      error:
        "No se pudo actualizar la contraseña. Verificá los requisitos e intentá de nuevo.",
    };
  }

  // Prove the password is actually usable before claiming success.
  // Do not treat updateUser alone as sufficient — E2E showed redirects
  // while signInWithPassword still rejected the chosen password.
  await supabase.auth.signOut();

  const { data: signedIn, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError || !signedIn.user) {
    return {
      ok: false,
      error:
        "La contraseña no quedó utilizable para iniciar sesión. Pedí un nuevo enlace de acceso e intentá de nuevo.",
    };
  }

  return { ok: true };
}
