import postgres from "postgres";
import { expect, test } from "../fixtures";
import { E2eCreatedResourceRegistry } from "../lib/e2e-run-scope";
import { E2E_WRITE_DEV_MODE } from "../lib/dev-write-guard";

class ExpectedCanaryRollback extends Error {}

type GeoTarget = {
  zone_id: string;
  city_id: string;
};

type CanaryApplication = {
  id: string;
  status: string;
  business_name: string;
};

test.describe("WRITE_DEV reversible database canary", () => {
  test("can insert inside a transaction and leaves no committed row", async () => {
    expect(process.env.E2E_MODE).toBe(E2E_WRITE_DEV_MODE);

    const databaseUrl = process.env.DATABASE_URL?.trim();
    expect(
      databaseUrl,
      "WRITE_DEV must provide DATABASE_URL after preflight",
    ).toBeTruthy();

    const registry = new E2eCreatedResourceRegistry();
    const marker = registry.marker;
    const sql = postgres(databaseUrl!, {
      max: 1,
      prepare: false,
    });

    let createdId: string | null = null;

    try {
      const [target] = await sql<GeoTarget[]>`
        select z.id as zone_id, z.city_id
        from zones z
        order by z.id
        limit 1
      `;

      expect(
        target,
        "DEV canary requires at least one existing zone",
      ).toBeTruthy();

      try {
        await sql.begin(async (tx) => {
          const [created] = await tx<CanaryApplication[]>`
            insert into merchant_applications (
              business_name,
              contact_name,
              contact_email,
              contact_phone,
              city_id,
              zone_id,
              description,
              message
            ) values (
              ${`${marker} DB write canary`},
              ${`${marker} Tester`},
              ${`e2e-canary-${registry.runId}@example.invalid`},
              ${"2800000000"},
              ${target.city_id},
              ${target.zone_id},
              ${"Reversible WRITE_DEV canary. This row must never commit."},
              ${marker}
            )
            returning id, status, business_name
          `;

          expect(created).toBeTruthy();
          createdId = created.id;
          registry.register({ kind: "other", id: created.id });

          expect(created.status).toBe("PENDING");
          expect(created.business_name).toBe(`${marker} DB write canary`);

          const [visibleInsideTransaction] = await tx<CanaryApplication[]>`
            select id, status, business_name
            from merchant_applications
            where id = ${created.id}
          `;

          expect(visibleInsideTransaction?.id).toBe(created.id);

          // A deliberate exception proves INSERT permission while forcing the
          // transaction to roll back. Assertion failures also roll back.
          throw new ExpectedCanaryRollback("rollback reversible DEV canary");
        });
      } catch (error) {
        if (!(error instanceof ExpectedCanaryRollback)) {
          throw error;
        }
      }

      expect(
        createdId,
        "canary must capture the exact inserted id",
      ).toBeTruthy();

      const rowsAfterRollback = await sql<{ id: string }[]>`
        select id
        from merchant_applications
        where id = ${createdId!}
      `;

      expect(rowsAfterRollback).toHaveLength(0);
      registry.clearRegistered({ kind: "other", id: createdId! });
      registry.assertCleanupComplete();
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
