"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ThemeSelector } from "@/components/ThemeSelector";
import { applyTheme, readStoredThemePreference, THEME_STORAGE_KEY, ThemePreference } from "@/lib/theme";

export default function SettingsPage() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const theme = readStoredThemePreference();
    setThemePreference(theme);
  }, []);

  function onSetTheme(nextTheme: ThemePreference) {
    setThemePreference(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <RequireAuth>
      <section className="section-shell animate-fade-in p-8 dark:border-slate-700/70 dark:bg-slate-900/75 dark:bg-none">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Personalize your workspace preferences and account experience. This page intentionally focuses on frontend controls.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="premium-card rounded-2xl p-5 dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Appearance</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Choose the theme for a comfortable clinical workspace.</p>
            <div className="mt-4">
              <ThemeSelector value={themePreference} onChange={onSetTheme} />
            </div>
          </article>

          <article className="premium-card rounded-2xl p-5 dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Account</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Profile and security settings will be connected here in a future backend iteration.
            </p>
          </article>

          <article className="premium-card rounded-2xl p-5 dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Preferences</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Notification defaults, report display options, and tool behavior can be managed in this section later.
            </p>
          </article>
        </div>
      </section>
    </RequireAuth>
  );
}
