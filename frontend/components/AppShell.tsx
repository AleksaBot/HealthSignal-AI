"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { clearToken, isLoggedIn } from "@/lib/api";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isLoggedIn());
  }, [pathname]);

  function onLogout() {
    clearToken();
    setAuthenticated(false);
    router.push("/");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-brand-700">
            HealthSignal AI
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {authenticated ? (
              <>
                <Link href="/dashboard" className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-brand-700">
                  Dashboard
                </Link>
                <button
                  onClick={onLogout}
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/auth" className="rounded-md bg-brand-700 px-3 py-1.5 text-white hover:bg-brand-600">
                Log In
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">{children}</main>
    </div>
  );
}
