import { LoginForm } from "./login-form";
import { sanitizeInternalPath } from "@/lib/safe-redirect";
import Link from "next/link";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";
import { isGoogleOAuthEnabled } from "@/config/auth-providers";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reset?: string;
  }>;
};

function friendlyLoginError(code: string | undefined): string | null {
  switch (code) {
    case "forbidden":
      return "No tenés acceso a esa sección.";
    case "expired_token":
      return "El enlace de acceso expiró o no es válido. Solicitá uno nuevo e intentá nuevamente.";
    case "invalid_token":
      return "El enlace de confirmación no es válido.";
    case "auth_config":
      return "La autenticación no está configurada en este entorno.";
    case "oauth_session":
      return "No pudimos completar el acceso con Google. Intentá nuevamente.";
    case "account_exists":
      return "Ya existe una cuenta con ese correo. Iniciá sesión con tu contraseña o pedí vincular Google de forma controlada. No creamos una cuenta nueva.";
    default:
      return null;
  }
}

function friendlyLoginSuccess(code: string | undefined): string | null {
  if (code === "success") {
    return "Contraseña actualizada. Ingresá con tu nueva contraseña.";
  }
  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params.next && sanitizeInternalPath(params.next, "\0") !== "\0"
      ? sanitizeInternalPath(params.next)
      : undefined;
  const banner = friendlyLoginError(params.error);
  const successBanner = friendlyLoginSuccess(params.reset);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <Link href="/" className="mb-8 w-fit">
        <PublicBrandWordmark size="header" tone="plain" />
      </Link>
      <section className="rounded-[1.75rem] border border-sky-100/80 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-xs font-bold tracking-wider text-[var(--ps-cyan)] uppercase">
          Cuenta
        </p>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-[var(--ps-navy)]">
          Ingresá a Pedilo
        </h1>
        <p className="mt-2 text-sm text-muted">
          Consultá tus pedidos y continuá tu compra. Si administrás un comercio,
          usá las mismas credenciales.
        </p>
        {banner ? (
          <p
            className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm"
            role="alert"
          >
            {banner}
          </p>
        ) : null}
        {successBanner ? (
          <p
            className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            role="status"
          >
            {successBanner}
          </p>
        ) : null}
        <div className="mt-7">
          <LoginForm
            nextPath={nextPath}
            googleOAuthEnabled={isGoogleOAuthEnabled()}
          />
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          ¿Todavía no tenés cuenta?{" "}
          <Link
            href={
              nextPath
                ? `/registro?next=${encodeURIComponent(nextPath)}`
                : "/registro"
            }
            className="font-bold text-[var(--ps-navy)] hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </section>
    </main>
  );
}
