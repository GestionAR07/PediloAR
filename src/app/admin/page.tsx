import { loadAdminContext } from "./_lib/load-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { profile, user } = await loadAdminContext("/admin");

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Panel administrativo
        </h1>
        <p className="text-sm text-muted">
          Onboarding asistido de comercios y configuración geográfica mínima.
        </p>
      </header>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted">Usuario</dt>
          <dd>{user.email ?? user.id}</dd>
        </div>
        <div>
          <dt className="text-muted">Rol de plataforma</dt>
          <dd>{profile.platformRole}</dd>
        </div>
        <div>
          <dt className="text-muted">Estado</dt>
          <dd>{profile.status}</dd>
        </div>
      </dl>
    </main>
  );
}
