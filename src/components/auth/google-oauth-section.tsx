"use client";

import { useActionState } from "react";
import {
  startGoogleOAuthAction,
  type GoogleOAuthState,
} from "@/app/auth/oauth/actions";

const initialState: GoogleOAuthState = { error: null };

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.39a4.62 4.62 0 0 1-2 3.03v2.54h3.24c1.9-1.75 2.97-4.33 2.97-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

export function GoogleOAuthSection({ nextPath }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(
    startGoogleOAuthAction,
    initialState,
  );

  return (
    <div className="space-y-4">
      <form action={action}>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-violet-100 bg-white px-5 text-sm font-extrabold text-[var(--ps-night-900)] shadow-sm transition hover:border-violet-200 hover:bg-violet-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-60"
        >
          <GoogleMark />
          {pending ? "Conectando con Google…" : "Continuar con Google"}
        </button>
      </form>
      {state.error ? (
        <p
          className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-violet-100" />
        <span className="text-xs font-medium text-muted">
          o continuá con email
        </span>
        <span className="h-px flex-1 bg-violet-100" />
      </div>
    </div>
  );
}
