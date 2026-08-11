import { LoginForm } from "./login-form";
import { sanitizeInternalPath } from "@/lib/safe-redirect";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

function friendlyLoginError(code: string | undefined): string | null {
  switch (code) {
    case "forbidden":
      return "No tenés acceso a esa sección.";
    case "expired_token":
      return "El enlace de invitación expiró o no es válido. Pedí una nueva invitación al administrador.";
    case "invalid_token":
      return "El enlace de confirmación no es válido.";
    case "auth_config":
      return "La autenticación no está configurada en este entorno.";
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params.next && sanitizeInternalPath(params.next, "\0") !== "\0"
      ? sanitizeInternalPath(params.next)
      : undefined;
  const banner = friendlyLoginError(params.error);

  return (
    <main className="flex flex-1 flex-col gap-8 border-t border-border pt-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Ingresar
        </h1>
        <p className="text-sm text-muted">
          Acceso interno de desarrollo. No hay registro público.
        </p>
      </header>

      {banner ? (
        <p
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          role="alert"
        >
          {banner}
        </p>
      ) : null}

      <LoginForm nextPath={nextPath} />
    </main>
  );
}
