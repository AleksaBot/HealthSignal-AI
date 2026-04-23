"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { clearToken, getCurrentUser, isLoggedIn } from "@/lib/api";
import { ThemeSelector } from "@/components/ThemeSelector";
import { applyTheme, readStoredThemePreference, THEME_STORAGE_KEY, ThemePreference } from "@/lib/theme";

const navItems = [
  { href: "/", label: "Dashboard", emphasis: false },
  { href: "/profile", label: "My Health", emphasis: true },
  { href: "/health-trends", label: "Health Trends", emphasis: false },
  { href: "/history", label: "Reports", emphasis: false },
  { href: "/pricing", label: "Pricing", emphasis: false }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const preference = readStoredThemePreference();
    setThemePreference(preference);
    applyTheme(preference);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => applyTheme(readStoredThemePreference());
    media.addEventListener("change", updateTheme);

    return () => media.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    const loggedIn = isLoggedIn();
    setAuthenticated(loggedIn);

    if (!loggedIn) {
      setFirstName(null);
      setEmail(null);
      return;
    }

    getCurrentUser()
      .then((user) => {
        setAuthenticated(true);
        setFirstName(user.first_name);
        setEmail(user.email);
      })
      .catch(() => {
        setAuthenticated(false);
        clearToken();
        setFirstName(null);
        setEmail(null);
      });
  }, [pathname]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  function onLogout() {
    clearToken();
    setAuthenticated(false);
    setFirstName(null);
    setEmail(null);
    setMenuOpen(false);
    router.push("/");
  }

  function onSetTheme(nextTheme: ThemePreference) {
    setThemePreference(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const displayName = useMemo(() => {
    const cleanedFirstName = firstName?.trim();
    if (cleanedFirstName) {
      return cleanedFirstName;
    }

    const cleanedEmail = email?.trim();
    if (!cleanedEmail) {
      return null;
    }

    const localPart = cleanedEmail.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    if (!localPart) {
      return null;
    }

    const [firstToken] = localPart.split(/\s+/);
    if (!firstToken) {
      return null;
    }

    return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
  }, [email, firstName]);

  const initials = useMemo(() => {
    if (displayName?.trim()) {
      return displayName.slice(0, 2).toUpperCase();
    }

    if (email?.trim()) {
      return email.slice(0, 2).toUpperCase();
    }

    return "HS";
  }, [displayName, email]);

  const profileLabel = displayName ?? "Account";

  return (
    <div className="site-backdrop">
      <header className="sticky top-0 z-30 border-b border-white/50 bg-white/70 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700/95 text-sm font-semibold text-white shadow-lg shadow-brand-700/25">
              HS
            </div>
            <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 transition hover:text-brand-700 dark:text-slate-100">
              HealthSignal AI
            </Link>
          </div>

          <nav className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-2 py-1 text-sm md:flex dark:border-slate-700 dark:bg-slate-900/70">
            {navItems.map((item) => {
              const active = pathname === item.href;

              const classes = item.emphasis
                ? active
                  ? "rounded-full border border-brand-500/70 bg-gradient-to-r from-brand-700 to-cyan-600 px-4 py-1.5 font-medium text-white shadow-md shadow-brand-700/35"
                  : "rounded-full border border-brand-200/90 bg-brand-50/85 px-4 py-1.5 font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-100/90 dark:border-brand-500/35 dark:bg-brand-900/35 dark:text-brand-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-900/55"
                : active
                  ? "rounded-full bg-brand-700 px-4 py-1.5 text-white shadow-md shadow-brand-700/25"
                  : "rounded-full px-4 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";

              return (
                <Link key={item.href} href={item.href} className={classes}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            {authenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2 py-1.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span className="hidden max-w-24 truncate text-xs font-medium sm:inline">{profileLabel}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">{initials}</span>
                </button>

                {menuOpen ? (
                  <div className="animate-fade-in absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName ?? "HealthSignal User"}</p>
                      {email ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      <Link
                        href="/account"
                        className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setMenuOpen(false)}
                      >
                        Account
                      </Link>
                      <Link
                        href="/settings"
                        className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setMenuOpen(false)}
                      >
                        Settings
                      </Link>
                    </div>
                    <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                    <div className="px-1 pb-1">
                      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Theme</p>
                      <ThemeSelector value={themePreference} onChange={onSetTheme} compact />
                    </div>
                    <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                    <button
                      onClick={onLogout}
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
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

      <main className="mx-auto w-full max-w-[1180px] space-y-8 overflow-x-clip px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-slate-200/70 bg-white/60 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/60">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-6 py-5 text-xs text-slate-600 md:flex-row md:items-center dark:text-slate-300">
          <p>HealthSignal AI provides educational health guidance and is not a medical diagnosis tool.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing" className="font-medium text-slate-700 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-300">Pricing</Link>
            <Link href="/privacy" className="font-medium text-slate-700 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-300">Privacy</Link>
            <Link href="/terms" className="font-medium text-slate-700 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-300">Terms</Link>
            <Link href="/contact" className="font-medium text-slate-700 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-300">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
