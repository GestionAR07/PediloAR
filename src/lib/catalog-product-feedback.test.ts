import { describe, expect, it } from "vitest";
import {
  parseProductSaveFeedback,
  productEditPath,
  productSaveFeedbackMessage,
} from "./catalog-product-feedback";

describe("parseProductSaveFeedback", () => {
  it("detects created feedback", () => {
    expect(parseProductSaveFeedback({ created: "1" })).toBe("created");
  });

  it("detects saved feedback", () => {
    expect(parseProductSaveFeedback({ saved: "1" })).toBe("saved");
  });

  it("ignores unknown or missing params", () => {
    expect(parseProductSaveFeedback({})).toBeNull();
    expect(parseProductSaveFeedback({ created: "yes" })).toBeNull();
  });
});

describe("productEditPath", () => {
  it("builds edit path with created flag", () => {
    expect(productEditPath("merchant-a", "prod-1", "created")).toBe(
      "/merchant/merchant-a/catalog/products/prod-1?created=1",
    );
  });

  it("builds edit path with saved flag", () => {
    expect(productEditPath("merchant-a", "prod-1", "saved")).toBe(
      "/merchant/merchant-a/catalog/products/prod-1?saved=1",
    );
  });
});

describe("productSaveFeedbackMessage", () => {
  it("returns create copy", () => {
    expect(productSaveFeedbackMessage("created")).toEqual({
      title: "Producto creado correctamente.",
      detail: "Ya podés configurar opciones y variedades.",
    });
  });

  it("returns update copy", () => {
    expect(productSaveFeedbackMessage("saved")).toEqual({
      title: "Cambios guardados.",
      detail: null,
    });
  });
});
