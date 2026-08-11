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
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.includes(".test.")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Strip block/line comments for a coarse static scan of export statements.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function isUseServerModule(source: string): boolean {
  // Directive at top of file (after optional whitespace/comments already stripped loosely)
  const head = source.trimStart().slice(0, 80);
  return (
    head.startsWith('"use server"') ||
    head.startsWith("'use server'") ||
    /^\s*["']use server["']\s*;/.test(source)
  );
}

describe("use server modules export async functions only", () => {
  it("does not export runtime objects/constants from use server files", () => {
    const files = walk(path.join(root, "src"));
    const useServerFiles = files.filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return isUseServerModule(text);
    });

    expect(useServerFiles.length).toBeGreaterThan(0);

    const forbiddenValueExport = /^\s*export\s+(const|let|var|class)\b/m;
    const nonAsyncFunctionExport = /^\s*export\s+function\b/m;
    const reexportValues = /^\s*export\s*\{[^}]*\}\s*;?\s*$/m;

    for (const file of useServerFiles) {
      const text = stripComments(fs.readFileSync(file, "utf8"));
      const rel = path.relative(root, file);

      expect(text, rel).not.toMatch(forbiddenValueExport);
      expect(text, rel).not.toMatch(nonAsyncFunctionExport);
      // Allowed: export type { X }, export type Y = ...
      // Disallow value re-exports that might re-export initial state objects.
      if (reexportValues.test(text) && !/export\s+type\s*\{/.test(text)) {
        const valueReexports = text
          .split("\n")
          .filter(
            (line) =>
              /^\s*export\s*\{/.test(line) && !/export\s+type\s*\{/.test(line),
          );
        expect(valueReexports, rel).toEqual([]);
      }
    }
  });

  it("admin action-state holds initialActionState outside use server", () => {
    const state = fs.readFileSync(
      path.join(root, "src/app/admin/action-state.ts"),
      "utf8",
    );
    const actions = fs.readFileSync(
      path.join(root, "src/app/admin/actions.ts"),
      "utf8",
    );

    expect(isUseServerModule(state)).toBe(false);
    expect(state).toContain("initialActionState");
    expect(isUseServerModule(actions)).toBe(true);
    expect(actions).not.toMatch(/export\s+const\s+initialActionState/);
    expect(actions).toMatch(/export async function createProvinceAction/);
  });
});
