import {
  parseCustomerNameSnapshot,
  parseCustomerPhoneSnapshot,
} from "@/domain/order/contact";
import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { sanitizeInternalPath } from "@/lib/safe-redirect";

export type CustomerContactProfile = {
  displayName: string | null;
  phone: string | null;
};

export type ValidCustomerContactProfile = {
  displayName: string;
  phone: string;
};

export type CustomerProfileDependencies = {
  updateCustomerContactProfile: (
    userId: string,
    profile: ValidCustomerContactProfile,
  ) => Promise<void>;
};

const PROFILE_PATH = "/cuenta/perfil";
const OAUTH_CONTINUE_PATH = "/auth/oauth/continue";

export function parseCustomerContactProfile(input: {
  displayName: string;
  phone: string;
}): Result<ValidCustomerContactProfile, DomainError> {
  const name = parseCustomerNameSnapshot(input.displayName);
  const phone = parseCustomerPhoneSnapshot(input.phone);
  if (!name.ok || !phone.ok) {
    return err(
      new DomainError(
        "CUSTOMER_PROFILE_INVALID",
        "Revisá tu nombre y teléfono.",
      ),
    );
  }
  return ok({ displayName: name.value, phone: phone.value });
}

export function hasCompleteCustomerContact(
  profile: CustomerContactProfile,
): boolean {
  return parseCustomerContactProfile({
    displayName: profile.displayName ?? "",
    phone: profile.phone ?? "",
  }).ok;
}

/** Prevent completion/callback redirect loops in addition to open redirects. */
export function sanitizeCustomerDestination(
  raw: string | null | undefined,
  fallback = "/cuenta",
): string {
  const destination = sanitizeInternalPath(raw, fallback);
  if (
    destination === PROFILE_PATH ||
    destination.startsWith(`${PROFILE_PATH}?`) ||
    destination === OAUTH_CONTINUE_PATH ||
    destination.startsWith(`${OAUTH_CONTINUE_PATH}?`)
  ) {
    return fallback;
  }
  return destination;
}

export function customerProfileHref(
  destination: string,
  required = false,
): string {
  const safeDestination = sanitizeCustomerDestination(destination);
  const query = new URLSearchParams({ next: safeDestination });
  if (required) {
    query.set("required", "1");
  }
  return `${PROFILE_PATH}?${query.toString()}`;
}

export async function updateCustomerContact(
  userId: string,
  input: { displayName: string; phone: string },
  deps: CustomerProfileDependencies,
): Promise<Result<ValidCustomerContactProfile, DomainError>> {
  const parsed = parseCustomerContactProfile(input);
  if (!parsed.ok) {
    return parsed;
  }
  await deps.updateCustomerContactProfile(userId, parsed.value);
  return parsed;
}
