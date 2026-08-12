import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/shared/errors";
import { parseMoneyInputToCents } from "./parse-money";

describe("parseMoneyInputToCents", () => {
  it("parses integer pesos", () => {
    expect(parseMoneyInputToCents("2500")).toBe(250000);
    expect(parseMoneyInputToCents("0")).toBe(0);
  });

  it("parses ARS decimal comma", () => {
    expect(parseMoneyInputToCents("2500,50")).toBe(250050);
    expect(parseMoneyInputToCents("2500,5")).toBe(250050);
  });

  it("parses formatted ARS with thousands separator", () => {
    expect(parseMoneyInputToCents("$2.500,50")).toBe(250050);
    expect(parseMoneyInputToCents("2.500,50")).toBe(250050);
  });

  it("parses dot decimal when unambiguous", () => {
    expect(parseMoneyInputToCents("25.50")).toBe(2550);
  });

  it("rejects empty and invalid input", () => {
    expect(() => parseMoneyInputToCents("")).toThrow(DomainError);
    expect(() => parseMoneyInputToCents("abc")).toThrow(DomainError);
    expect(() => parseMoneyInputToCents("-100")).toThrow(DomainError);
  });

  it("rejects negative amounts via domain guard", () => {
    expect(() => parseMoneyInputToCents("-1")).toThrow(DomainError);
  });
});
