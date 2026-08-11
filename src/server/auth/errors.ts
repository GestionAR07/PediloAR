/**
 * Authz error codes for server-side authorization helpers.
 * These are not HTTP responses — callers map them to redirects/messages.
 */
export type AuthzErrorCode =
  | "UNAUTHENTICATED"
  | "PROFILE_MISSING"
  | "USER_SUSPENDED"
  | "NOT_PLATFORM_ADMIN"
  | "NOT_MERCHANT_MEMBER"
  | "MERCHANT_ROLE_FORBIDDEN"
  | "CONFIG_MISSING";

export class AuthzError extends Error {
  readonly code: AuthzErrorCode;

  constructor(code: AuthzErrorCode, message: string) {
    super(message);
    this.name = "AuthzError";
    this.code = code;
  }
}

export function isAuthzError(error: unknown): error is AuthzError {
  return error instanceof AuthzError;
}
