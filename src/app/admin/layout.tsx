import { AdminNav } from "./_components/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 border-t border-border pt-8">
      <AdminNav />
      {children}
    </div>
  );
}
