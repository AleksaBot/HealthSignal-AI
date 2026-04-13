"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { clearToken, getCurrentUser, isLoggedIn } from "@/lib/api";

const navItems = [
  { href: "/", label: "Command Center" },
  { href: "/dashboard", label: "Operations" },
  { href: "/history", label: "Reports" }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const loggedIn = isLoggedIn();
    setAuthenticated(loggedIn);

    if (!loggedIn) {
      setFirstName(null);
      return;
    }

    getCurrentUser()
      .then((user) => setFirstName(user.first_name))
      .catch(() => setFirstName(null));
  }, [pathname]);

  function onLogout() {
    clearToken();
    setAuthenticated(false);
    setFirstName(null);
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700/95 text-sm font-semibold text-white shadow-lg shadow-brand-700/25">
              HS
            </div>
            <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 transition hover:text-brand-700">
              HealthSignal AI
            </Link>
          </div>

          <nav className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-2 py-1 text-sm md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-1.5 transition ${
                    active ? "bg-brand-700 text-white shadow-md shadow-brand-700/25" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            {authenticated ? (
              <>
                {firstName ? <span className="hidden text-slate-500 sm:inline">Signed in as {firstName}</span> : null}
                <button
                  onClick={onLogout}
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="rounded-lg bg-brand-700 px-3 py-1.5 font-medium text-white shadow-md shadow-brand-700/20 transition hover:-translate-y-0.5 hover:bg-brand-600"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">{children}</main>
    </div>
  );
}
