import { describe, expect, it } from "vitest";
import {
  gateOAuthEmail,
  isConflictingAuthIdentity,
  isOAuthEmailVerified,
  oauthDisplayNameFromMetadata,
  shouldCollectCustomerContactBeforeDestination,
} from "./oauth-identity";

describe("OAuth identity gates", () => {
  it("requires a verified email before any email-based reuse check", () => {
    expect(gateOAuthEmail({ email: null, emailVerified: true })).toEqual({
      ok: false,
      reason: "missing_email",
    });
    expect(
      gateOAuthEmail({ email: "owner@example.com", emailVerified: false }),
    ).toEqual({ ok: false, reason: "unverified_email" });
    expect(
      gateOAuthEmail({ email: " owner@example.com ", emailVerified: true }),
    ).toEqual({ ok: true, email: "owner@example.com" });
  });

  it("treats Google confirmed timestamps and identity flags as verified", () => {
    expect(
      isOAuthEmailVerified({
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(true);
    expect(
      isOAuthEmailVerified({
        email: "owner@example.com",
        identities: [
          {
            provider: "google",
            identity_data: { email_verified: true },
          },
        ],
      }),
    ).toBe(true);
    expect(
      isOAuthEmailVerified({
        email: "owner@example.com",
        user_metadata: { email_verified: "true" },
      }),
    ).toBe(true);
    expect(isOAuthEmailVerified({ email: "owner@example.com" })).toBe(false);
  });

  it("never treats a different auth user with the same email as reusable", () => {
    expect(
      isConflictingAuthIdentity({
        sessionUserId: "google-new",
        otherUserIdWithSameEmail: "owner-existing",
      }),
    ).toBe(true);
    expect(
      isConflictingAuthIdentity({
        sessionUserId: "owner-existing",
        otherUserIdWithSameEmail: "owner-existing",
      }),
    ).toBe(false);
    expect(
      isConflictingAuthIdentity({
        sessionUserId: "owner-existing",
        otherUserIdWithSameEmail: null,
      }),
    ).toBe(false);
  });

  it("reads Google display names without inventing contact data", () => {
    expect(
      oauthDisplayNameFromMetadata({ full_name: "Ana Owner", name: "Ana" }),
    ).toBe("Ana Owner");
    expect(oauthDisplayNameFromMetadata({ name: "  " })).toBeNull();
    expect(oauthDisplayNameFromMetadata(null)).toBeNull();
  });

  it("skips customer onboarding for merchant and admin destinations", () => {
    expect(
      shouldCollectCustomerContactBeforeDestination(
        "/merchant/11111111-1111-4111-8111-111111111111",
      ),
    ).toBe(false);
    expect(shouldCollectCustomerContactBeforeDestination("/admin")).toBe(false);
    expect(shouldCollectCustomerContactBeforeDestination("/cuenta")).toBe(true);
    expect(
      shouldCollectCustomerContactBeforeDestination("/cuenta/pedidos"),
    ).toBe(true);
    expect(shouldCollectCustomerContactBeforeDestination("/checkout")).toBe(
      true,
    );
  });
});
