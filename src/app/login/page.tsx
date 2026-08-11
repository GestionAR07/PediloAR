import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : undefined;

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

      <LoginForm nextPath={nextPath} />
    </main>
  );
}
