import { describe, expect, it, vi, beforeEach } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const createSupabaseServerClient = vi.fn();
const hasSupabasePublicConfig = vi.fn(() => true);
const hasDatabaseConfig = vi.fn(() => false);

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));

vi.mock("@/infrastructure/supabase/env", () => ({
  hasSupabasePublicConfig: () => hasSupabasePublicConfig(),
}));

vi.mock("@/infrastructure/db/env", () => ({
  hasDatabaseConfig: () => hasDatabaseConfig(),
}));

describe("loginAction password handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabasePublicConfig.mockReturnValue(true);
    hasDatabaseConfig.mockReturnValue(false);
  });

  async function loadAction() {
    return import("./actions");
  }

  it("passes password to signInWithPassword without transformation", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithPassword, signOut: vi.fn() },
    });

    const { loginAction } = await loadAction();
    const form = new FormData();
    form.set("email", "  Owner@Example.com ");
    form.set("password", "  Exact Pass!");

    await expect(loginAction({ error: null }, form)).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "  Exact Pass!",
    });
  });

  it("surfaces credential errors (not forbidden)", async () => {
    createSupabaseServerClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid login credentials" },
        }),
        signOut: vi.fn(),
      },
    });

    const { loginAction } = await loadAction();
    const form = new FormData();
    form.set("email", "owner@example.com");
    form.set("password", "wrong-password");

    const state = await loginAction({ error: null }, form);
    expect(state.error).toBe(
      "Credenciales inválidas. Verificá email y contraseña.",
    );
    expect(state.error?.toLowerCase()).not.toContain("forbidden");
    expect(redirect).not.toHaveBeenCalled();
  });
});
