import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("public password recovery", () => {
  const actions = read("src/app/forgot-password/actions.ts");
  const form = read("src/app/forgot-password/forgot-password-form.tsx");
  const page = read("src/app/forgot-password/page.tsx");
  const loginForm = read("src/app/login/login-form.tsx");
  const confirmRoute = read("src/app/auth/confirm/route.ts");

  it("exposes a public recovery entry point from login", () => {
    expect(loginForm).toContain('href="/forgot-password"');
    expect(loginForm).toContain("Olvidé mi contraseña");
    expect(page).toContain("Recuperá tu contraseña");
    expect(page).toContain("ForgotPasswordForm");
  });

  it("requests recovery through the normal Supabase session client", () => {
    expect(actions).toContain("createSupabaseServerClient");
    expect(actions).toContain("resetPasswordForEmail");
    expect(actions).toContain("appAbsoluteUrl");
    expect(actions).toContain(
      '"/auth/confirm?type=recovery&next=/set-password"',
    );
    expect(actions).not.toContain("SUPABASE_SECRET_KEY");
    expect(actions).not.toContain("auth.admin");
  });

  it("does not reveal whether an account exists", () => {
    const neutralCopy =
      "Si existe una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.";
    expect(actions).toContain(neutralCopy);
    expect(page).toContain("Si está registrado");
    expect(actions).not.toMatch(/usuario no existe|cuenta no existe|email no registrado/i);
  });

  it("validates configuration and email before sending", () => {
    expect(actions).toContain("hasSupabasePublicConfig()");
    expect(actions).toContain("hasAppBaseUrl()");
    expect(actions).toContain("isPlausibleEmail");
    expect(form).toContain('type="email"');
    expect(form).toContain('autoComplete="email"');
    expect(form).toContain("required");
  });

  it("keeps recovery on the existing SSR callback and set-password route", () => {
    expect(confirmRoute).toContain('"recovery"');
    expect(confirmRoute).toContain('"/set-password"');
    expect(confirmRoute).not.toContain("PASSWORD_RECOVERY_NOT_IMPLEMENTED");
  });
});
