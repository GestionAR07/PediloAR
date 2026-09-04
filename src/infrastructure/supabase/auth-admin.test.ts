import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findAuthUserByEmail,
  findConflictingAuthUserByEmail,
} from "./auth-admin";

describe("findAuthUserByEmail pagination", () => {
  it("scans beyond the first page", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          users: Array.from({ length: 200 }, (_, i) => ({
            id: `u-${i}`,
            email: `u${i}@example.com`,
          })),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          users: [
            {
              id: "target",
              email: "owner@example.com",
              email_confirmed_at: "2024-01-01",
            },
          ],
        },
        error: null,
      });

    const admin = {
      auth: { admin: { listUsers } },
    } as unknown as SupabaseClient;

    const found = await findAuthUserByEmail(admin, "owner@example.com");
    expect(found?.id).toBe("target");
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
  });

  it("returns null when absent", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [{ id: "1", email: "other@example.com" }] },
      error: null,
    });
    const admin = {
      auth: { admin: { listUsers } },
    } as unknown as SupabaseClient;

    const found = await findAuthUserByEmail(admin, "missing@example.com");
    expect(found).toBeNull();
  });

  it("returns a different auth user with the same email and ignores the session user", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          { id: "google-new", email: "owner@example.com" },
          {
            id: "owner-existing",
            email: "owner@example.com",
            email_confirmed_at: "2024-01-01",
          },
        ],
      },
      error: null,
    });
    const admin = {
      auth: { admin: { listUsers } },
    } as unknown as SupabaseClient;

    const conflict = await findConflictingAuthUserByEmail(
      admin,
      "owner@example.com",
      "google-new",
    );
    expect(conflict?.id).toBe("owner-existing");
  });

  it("returns null when the only match is the session user", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [{ id: "owner-existing", email: "owner@example.com" }],
      },
      error: null,
    });
    const admin = {
      auth: { admin: { listUsers } },
    } as unknown as SupabaseClient;

    await expect(
      findConflictingAuthUserByEmail(
        admin,
        "owner@example.com",
        "owner-existing",
      ),
    ).resolves.toBeNull();
  });
});
