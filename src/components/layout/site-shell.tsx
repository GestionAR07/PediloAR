import type { ReactNode } from "react";

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-10 sm:px-8 sm:py-14">
      {children}
    </div>
  );
}
