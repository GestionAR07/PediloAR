import { randomUUID } from "node:crypto";

export type E2eResourceKind =
  | "auth_user"
  | "merchant"
  | "product"
  | "order"
  | "delivery"
  | "other";

export type E2eCreatedResource = {
  kind: E2eResourceKind;
  id: string;
};

const RUN_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export function createE2eRunId(): string {
  return randomUUID().replaceAll("-", "");
}

export function e2eRunMarker(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error("E2E resource scope: invalid run id.");
  }
  return `[E2E:${runId}]`;
}

/**
 * In-memory registry for future write-capable fixtures.
 * Cleanup adapters must receive exact IDs from this registry; broad deletes,
 * TRUNCATE, or cleanup by unscoped text search are intentionally unsupported.
 */
export class E2eCreatedResourceRegistry {
  readonly runId: string;
  readonly marker: string;
  readonly #resources: E2eCreatedResource[] = [];

  constructor(runId: string = createE2eRunId()) {
    this.runId = runId;
    this.marker = e2eRunMarker(runId);
  }

  register(resource: E2eCreatedResource): void {
    const id = resource.id.trim();
    if (!id) {
      throw new Error("E2E resource scope: resource id is required.");
    }
    if (this.#resources.some((current) => current.kind === resource.kind && current.id === id)) {
      return;
    }
    this.#resources.push({ ...resource, id });
  }

  list(): readonly E2eCreatedResource[] {
    return this.#resources.map((resource) => ({ ...resource }));
  }

  clearRegistered(resource: E2eCreatedResource): void {
    const index = this.#resources.findIndex(
      (current) => current.kind === resource.kind && current.id === resource.id,
    );
    if (index >= 0) {
      this.#resources.splice(index, 1);
    }
  }

  assertCleanupComplete(): void {
    if (this.#resources.length === 0) {
      return;
    }
    throw new Error(
      `E2E cleanup incomplete: ${this.#resources.length} scoped resource(s) remain registered.`,
    );
  }
}
