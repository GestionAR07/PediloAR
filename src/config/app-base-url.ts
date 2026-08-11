/**
 * Server-side public origin of this app (for invitation emails / redirects).
 * Never hardcode localhost permanently in business logic.
 */

export type EnvLike = Readonly<Record<string, string | undefined>>;

export type AppBaseUrlConfig = {
  baseUrl: string;
  isHttps: boolean;
};

function stripTrailingSlash(url: string): string {
  if (url.length > 1 && url.endsWith("/")) {
    return url.slice(0, -1);
  }
  return url;
}

export function hasAppBaseUrl(env: EnvLike = process.env): boolean {
  return Boolean(env.APP_BASE_URL?.trim());
}

/**
 * Validates and normalizes APP_BASE_URL.
 * http is allowed (local development); production should use https.
 */
export function getAppBaseUrl(env: EnvLike = process.env): AppBaseUrlConfig {
  const raw = env.APP_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "APP_BASE_URL is required for invitation redirects. Set it in .env.local (e.g. http://localhost:3001).",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("APP_BASE_URL must be a valid absolute URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("APP_BASE_URL must use http or https");
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error("APP_BASE_URL must not include credentials");
  }

  const baseUrl = stripTrailingSlash(
    parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname),
  );

  return {
    baseUrl,
    isHttps: parsed.protocol === "https:",
  };
}

/** Build an absolute app URL for an internal path (must start with /). */
export function appAbsoluteUrl(
  internalPath: string,
  env: EnvLike = process.env,
): string {
  const { baseUrl } = getAppBaseUrl(env);
  const path = internalPath.startsWith("/") ? internalPath : `/${internalPath}`;
  return `${baseUrl}${path}`;
}
