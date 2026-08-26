import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const createSupabaseServerClient = vi.fn();
const isGoogleOAuthEnabled = vi.fn(() => true);
const hasSupabasePublicConfig = vi.fn(() => true);

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/config/auth-providers", () => ({
  isGoogleOAuthEnabled: () => isGoogleOAuthEnabled(),
}));
vi.mock("@/infrastructure/supabase/env", () => ({
  hasSupabasePublicConfig: () => hasSupabasePublicConfig(),
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));

describe("startGoogleOAuthAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGoogleOAuthEnabled.mockReturnValue(true);
    hasSupabasePublicConfig.mockReturnValue(true);
    process.env.APP_BASE_URL = "http://localhost:3001";
  });

  it("keeps the provider unavailable until explicitly configured", async () => {
    isGoogleOAuthEnabled.mockReturnValue(false);
    const { startGoogleOAuthAction } = await import("./actions");
    const state = await startGoogleOAuthAction({ error: null }, new FormData());
    expect(state.error).toContain("todavía no está disponible");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("starts Google PKCE and preserves a safe checkout destination", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithOAuth },
    });
    const { startGoogleOAuthAction } = await import("./actions");
    const form = new FormData();
    form.set("next", "/checkout");

    await expect(startGoogleOAuthAction({ error: null }, form)).rejects.toThrow(
      "NEXT_REDIRECT:https://accounts.google.com",
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3001/auth/confirm?next=%2Fauth%2Foauth%2Fcontinue%3Fnext%3D%252Fcheckout",
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("drops external post-login destinations", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/oauth" },
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithOAuth },
    });
    const { startGoogleOAuthAction } = await import("./actions");
    const form = new FormData();
    form.set("next", "https://evil.test");

    await expect(startGoogleOAuthAction({ error: null }, form)).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo:
            "http://localhost:3001/auth/confirm?next=%2Fauth%2Foauth%2Fcontinue",
        }),
      }),
    );
  });
});
