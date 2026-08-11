import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("merchant onboarding security static checks", () => {
  it("does not publish SUPABASE_SECRET_KEY as NEXT_PUBLIC", () => {
    const example = read(".env.example");
    expect(example).toContain("SUPABASE_SECRET_KEY=");
    expect(example).not.toMatch(/NEXT_PUBLIC_SUPABASE_SECRET_KEY\s*=/);
    expect(example).toContain("APP_BASE_URL=");
  });

  it("admin client is server-only", () => {
    const admin = read("src/infrastructure/supabase/admin.ts");
    expect(admin).toContain('import "server-only"');
    expect(admin).toContain("persistSession: false");
    expect(admin).toContain("autoRefreshToken: false");
    expect(admin).toContain("detectSessionInUrl: false");
  });

  it("secret is never referenced from Client Components", () => {
    const files = walk(path.join(root, "src"));
    const clientFiles = files.filter((file) => {
      if (file.includes(".test.") || file.includes(".spec.")) {
        return false;
      }
      const text = fs.readFileSync(file, "utf8");
      // First non-empty statement-ish lines only — avoid matching string literals in tests/docs-as-code.
      const head = text.slice(0, 400);
      return (
        /^\s*["']use client["']\s*;/m.test(text) ||
        head.startsWith('"use client"') ||
        head.startsWith("'use client'") ||
        head.includes('\n"use client"') ||
        head.includes("\n'use client'")
      );
    });

    expect(clientFiles.length).toBeGreaterThan(0);

    for (const file of clientFiles) {
      const text = fs.readFileSync(file, "utf8");
      expect(text).not.toMatch(/SUPABASE_SECRET_KEY/);
      expect(text).not.toMatch(/createSupabaseAdminClient/);
      expect(text).not.toMatch(/from ["']@\/infrastructure\/supabase\/admin/);
    }
  });

  it("does not add permissive USING(true) policies in migrations", () => {
    const drizzleDir = path.join(root, "drizzle");
    for (const file of fs.readdirSync(drizzleDir)) {
      if (!file.endsWith(".sql")) continue;
      const sql = fs.readFileSync(path.join(drizzleDir, file), "utf8");
      expect(sql.includes("USING (true)")).toBe(false);
      expect(sql.includes("USING(true)")).toBe(false);
    }
  });

  it("does not modify foundational migrations 0000 and 0001", () => {
    const m0 = read("drizzle/0000_luxuriant_puma.sql");
    const m1 = read("drizzle/0001_auth_foundation.sql");
    expect(m0.length).toBeGreaterThan(1000);
    expect(m1).toContain("handle_new_auth_user");
    expect(m1).toContain('CREATE POLICY "merchants_select_member"');
  });

  it("login surfaces forbidden message for error=forbidden", () => {
    const login = read("src/app/login/page.tsx");
    expect(login).toContain("No tenés acceso a esa sección.");
    expect(login).toContain("error");
  });

  it("auth confirm route exists with invite support and safe next", () => {
    const confirm = read("src/app/auth/confirm/route.ts");
    expect(confirm).toContain("token_hash");
    expect(confirm).toContain("invite");
    expect(confirm).toContain("verifyOtp");
    expect(confirm).toContain("sanitizeInternalPath");
  });

  it("set-password requires authenticated session", () => {
    const page = read("src/app/set-password/page.tsx");
    expect(page).toContain("getUser");
    expect(page).toContain("redirect");
    expect(page).toContain("/login?next=/set-password");
  });
});
