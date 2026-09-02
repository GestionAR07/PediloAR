import fs from "node:fs";
import { format } from "prettier";
import { expect, it } from "vitest";

it("prints exact Prettier output for the remaining files", async () => {
  for (const file of [
    "e2e/lib/e2e-run-scope.ts",
    "e2e/lib/e2e-runtime-mode.ts",
  ]) {
    const source = fs.readFileSync(file, "utf8");
    const formatted = await format(source, {
      parser: "typescript",
      semi: true,
      singleQuote: false,
      trailingComma: "all",
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      arrowParens: "always",
      endOfLine: "lf",
    });
    console.log(`PRETTIER_OUTPUT_START:${file}`);
    console.log(formatted);
    console.log(`PRETTIER_OUTPUT_END:${file}`);
  }

  expect("debug").toBe("remove-this-test");
});
