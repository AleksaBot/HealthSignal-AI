"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <section className="section-shell animate-fade-in p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Profile</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
          Profile editing will be available soon. You can already control your workspace appearance in Settings.
        </p>
        <Link
          href="/settings"
          className="mt-6 inline-flex rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/20 transition hover:bg-brand-600"
        >
          Open Settings
        </Link>
      </section>
    </RequireAuth>
  );
}
