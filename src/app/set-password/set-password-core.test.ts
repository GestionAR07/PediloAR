import { describe, expect, it, vi } from "vitest";
import {
  persistInvitedUserPassword,
  validateSetPasswordFields,
  type UserScopedAuthClient,
} from "./set-password-core";

function makeClient(
  overrides: Partial<UserScopedAuthClient["auth"]> = {},
): UserScopedAuthClient {
  const auth: UserScopedAuthClient["auth"] = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "u1", email: "owner@example.com" } },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "access",
          refresh_token: "refresh",
        },
      },
      error: null,
    }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    }),
    ...overrides,
  };
  return { auth };
}

describe("validateSetPasswordFields", () => {
  it("requires both fields", () => {
    expect(validateSetPasswordFields({ password: "", confirm: "x" }).ok).toBe(
      false,
    );
    expect(validateSetPasswordFields({ password: "x", confirm: "" }).ok).toBe(
      false,
    );
  });

  it("requires matching passwords", () => {
    const result = validateSetPasswordFields({
      password: "password1",
      confirm: "password2",
    });
    expect(result).toEqual({
      ok: false,
      error: "Las contraseñas no coinciden.",
    });
  });

  it("does not trim or alter the password", () => {
    const password = "  secret12";
    const result = validateSetPasswordFields({
      password,
      confirm: password,
    });
    expect(result).toEqual({ ok: true, password: "  secret12" });
  });

  it("enforces min length 8 without mutating", () => {
    const result = validateSetPasswordFields({
      password: "short",
      confirm: "short",
    });
    expect(result.ok).toBe(false);
  });
});

describe("persistInvitedUserPassword", () => {
  it("requires an authenticated user", async () => {
    const supabase = makeClient({
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "no session" },
      }),
    });

    const result = await persistInvitedUserPassword(supabase, "password12");
    expect(result).toEqual({
      ok: false,
      unauthenticated: true,
      error: "Sesión inválida.",
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser with the exact password", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const supabase = makeClient({ updateUser });

    const password = "  ExactPass9";
    const result = await persistInvitedUserPassword(supabase, password);

    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ password: "  ExactPass9" });
  });

  it("explains when Supabase rejects reusing the current password", async () => {
    const supabase = makeClient({
      updateUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: {
          message: "New password should be different from the old password.",
        },
      }),
    });

    const result = await persistInvitedUserPassword(supabase, "password12");
    expect(result).toEqual({
      ok: false,
      error: "La nueva contraseña debe ser distinta de la contraseña actual.",
    });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("does not succeed when updateUser returns an error", async () => {
    const supabase = makeClient({
      updateUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "Weak password" },
      }),
    });

    const result = await persistInvitedUserPassword(supabase, "password12");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/No se pudo actualizar/);
    }
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("does not succeed when updateUser returns no user", async () => {
    const supabase = makeClient({
      updateUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    });

    const result = await persistInvitedUserPassword(supabase, "password12");
    expect(result.ok).toBe(false);
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("fails when password is not usable via signInWithPassword after update", async () => {
    const supabase = makeClient({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      }),
    });

    const result = await persistInvitedUserPassword(supabase, "password12");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/no quedó utilizable/);
    }
  });

  it("rebinds session before updateUser and verifies with exact password", async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const supabase = makeClient({ setSession, signInWithPassword });

    const password = "OwnerPass99";
    await persistInvitedUserPassword(supabase, password);

    expect(setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "OwnerPass99",
    });
  });

  it("fails when session tokens are missing", async () => {
    const supabase = makeClient({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    });

    const result = await persistInvitedUserPassword(supabase, "password12");
    expect(result.ok).toBe(false);
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });
});
