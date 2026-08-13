import { describe, expect, it } from "vitest";
import {
  parseCustomerNameSnapshot,
  parseCustomerPhoneSnapshot,
  snapshotMerchantName,
} from "./contact";

describe("parseCustomerNameSnapshot", () => {
  it("trims and accepts a valid name", () => {
    const result = parseCustomerNameSnapshot("  Ana Pérez  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Ana Pérez");
    }
  });

  it("rejects empty and whitespace-only names", () => {
    const empty = parseCustomerNameSnapshot("");
    const spaces = parseCustomerNameSnapshot("   ");
    expect(empty.ok).toBe(false);
    expect(spaces.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error.code).toBe("CUSTOMER_NAME_EMPTY");
    }
  });
});

describe("parseCustomerPhoneSnapshot", () => {
  it("accepts Argentine formats without destroying presentation", () => {
    const samples = [
      "+54 9 280 412-3456",
      "0280 412-3456",
      "(011) 15-1234-5678",
      "2804123456",
    ];
    for (const sample of samples) {
      const result = parseCustomerPhoneSnapshot(`  ${sample}  `);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(sample);
        expect(result.value).toContain(sample.includes("+") ? "+" : sample[0]);
      }
    }
  });

  it("rejects empty phone", () => {
    const result = parseCustomerPhoneSnapshot("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CUSTOMER_PHONE_EMPTY");
    }
  });

  it("rejects letters and too few digits", () => {
    const letters = parseCustomerPhoneSnapshot("telefono");
    const short = parseCustomerPhoneSnapshot("1234");
    expect(letters.ok).toBe(false);
    expect(short.ok).toBe(false);
  });
});

describe("snapshotMerchantName", () => {
  it("freezes the server merchant name, not a browser alias", () => {
    const merchantRowName = "Empanadas del Puerto";
    const browserAttempt = "Nombre falso del cliente";
    const result = snapshotMerchantName(merchantRowName);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(merchantRowName);
      expect(result.value).not.toBe(browserAttempt);
    }
  });

  it("rejects blank merchant names", () => {
    const result = snapshotMerchantName("  ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_NAME_SNAPSHOT_EMPTY");
    }
  });
});
