"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { clearToken, getCurrentUser, getUserErrorMessage } from "@/lib/api";

type AccountState = {
  first_name: string;
  email: string;
};

export default function AccountPage() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccount() {
      setLoading(true);
      setError(null);
      try {
        const response = await getCurrentUser();
        setAccount({
          first_name: response.first_name,
          email: response.email
        });
      } catch (err) {
        clearToken();
        setError(getUserErrorMessage(err, "Unable to load account details."));
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  return (
    <RequireAuth>
      <section className="section-shell animate-fade-in space-y-6 p-8">
        <div className="space-y-2 border-b border-slate-200/80 pb-4 dark:border-slate-700/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Account</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Account overview</h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">Manage your user identity and workspace-level account settings from this menu.</p>
        </div>

        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading account...</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        {account ? (
          <div className="grid gap-4 md:grid-cols-3">
            <article className="premium-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">First name</h2>
              <p className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">{account.first_name || "Not set"}</p>
            </article>
            <article className="premium-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</h2>
              <p className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">{account.email}</p>
            </article>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/settings" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">Open Settings</Link>
          <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">Return to Dashboard</Link>
        </div>
      </section>
    </RequireAuth>
  );
}
