import { describe, expect, it, vi, beforeEach } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

const createSupabaseServerClient = vi.fn();
const hasSupabasePublicConfig = vi.fn(() => true);

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));

vi.mock("@/infrastructure/supabase/env", () => ({
  hasSupabasePublicConfig: () => hasSupabasePublicConfig(),
}));

describe("setPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabasePublicConfig.mockReturnValue(true);
  });

  async function loadAction() {
    return import("./actions");
  }

  it("uses user-scoped server client, not admin", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/set-password/actions.ts"),
      "utf8",
    );
    expect(source).toContain("createSupabaseServerClient");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("SUPABASE_SECRET_KEY");
    expect(source).toContain("persistInvitedUserPassword");
  });

  it("returns validation error when passwords differ (no redirect)", async () => {
    const { setPasswordAction } = await loadAction();
    const form = new FormData();
    form.set("password", "password12");
    form.set("confirm", "password99");

    const state = await setPasswordAction({ error: null }, form);
    expect(state.error).toBe("Las contraseñas no coinciden.");
    expect(redirect).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not redirect when updateUser fails", async () => {
    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u1", email: "owner@example.com" } },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: "a", refresh_token: "r" },
          },
          error: null,
        }),
        setSession: vi.fn().mockResolvedValue({ error: null }),
        updateUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "fail" },
        }),
        signOut: vi.fn(),
        signInWithPassword: vi.fn(),
      },
    });

    const { setPasswordAction } = await loadAction();
    const form = new FormData();
    form.set("password", "password12");
    form.set("confirm", "password12");

    const state = await setPasswordAction({ error: null }, form);
    expect(state.error).toMatch(/No se pudo actualizar/);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects only after updateUser + signInWithPassword succeed", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u1", email: "owner@example.com" } },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: "a", refresh_token: "r" },
          },
          error: null,
        }),
        setSession: vi.fn().mockResolvedValue({ error: null }),
        updateUser,
        signOut: vi.fn().mockResolvedValue({ error: null }),
        signInWithPassword,
      },
    });

    const { setPasswordAction } = await loadAction();
    const form = new FormData();
    form.set("password", "password12");
    form.set("confirm", "password12");

    await expect(setPasswordAction({ error: null }, form)).rejects.toThrow(
      "NEXT_REDIRECT:/merchant",
    );
    expect(updateUser).toHaveBeenCalledWith({ password: "password12" });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "password12",
    });
  });

  it("does not trim password from FormData", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u1", email: "owner@example.com" } },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: "a", refresh_token: "r" },
          },
          error: null,
        }),
        setSession: vi.fn().mockResolvedValue({ error: null }),
        updateUser,
        signOut: vi.fn().mockResolvedValue({ error: null }),
        signInWithPassword,
      },
    });

    const { setPasswordAction } = await loadAction();
    const form = new FormData();
    form.set("password", "  keepSpaces9");
    form.set("confirm", "  keepSpaces9");

    await expect(setPasswordAction({ error: null }, form)).rejects.toThrow(
      "NEXT_REDIRECT:/merchant",
    );
    expect(updateUser).toHaveBeenCalledWith({ password: "  keepSpaces9" });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "  keepSpaces9",
    });
  });
});
