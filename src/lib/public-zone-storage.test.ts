import { describe, expect, it } from "vitest";
import {
  PUBLIC_ZONE_STORAGE_KEY,
  readPublicZoneId,
  writePublicZoneId,
} from "./public-zone-storage";

describe("public zone storage", () => {
  it("persists the discovery zone under the shared key", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    writePublicZoneId(storage, "zone-1");
    expect(memory.get(PUBLIC_ZONE_STORAGE_KEY)).toBe("zone-1");
    expect(readPublicZoneId(storage)).toBe("zone-1");
  });
});
