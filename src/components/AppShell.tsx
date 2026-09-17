import type { ReactNode } from "react";
import MainNav from "@/components/MainNav";

/**
 * Deliberately minimal: no wrapping container or padding around children.
 * `body` is already `flex flex-col`, and each page's own `<main>` relies on
 * being a direct flex child (e.g. `flex-1` for full-height layout, or a
 * centered sign-in card) — wrapping it in an extra div here would break
 * that without adding anything.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <MainNav />
      {children}
    </>
  );
}
