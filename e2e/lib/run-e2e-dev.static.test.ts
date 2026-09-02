import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const runnerPath = path.resolve("e2e/lib/run-e2e-dev.cjs");
const source = fs.readFileSync(runnerPath, "utf8");

describe("WRITE_DEV launcher", () => {
  it("invokes the local Playwright CLI through Node without a shell", () => {
    expect(source).toContain('"@playwright",');
    expect(source).toContain('"test",');
    expect(source).toContain('"cli.js",');
    expect(source).toContain("spawnSync(process.execPath, args");
    expect(source).not.toContain("spawnSync(command, args");
    expect(source).not.toContain("shell: true");
  });
});
