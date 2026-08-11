import { type NextRequest } from "next/server";
import { updateSession } from "@/infrastructure/supabase/update-session";

/**
 * Next.js 16 proxy — session refresh only.
 * Authorization for protected resources stays in server pages/actions.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip static assets and image optimization.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
