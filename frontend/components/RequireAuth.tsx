"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { clearToken, getCurrentUser, isLoggedIn } from "@/lib/api";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      setAuthenticated(false);
      setReady(true);
      return;
    }

    getCurrentUser()
      .then(() => {
        setAuthenticated(true);
      })
      .catch(() => {
        clearToken();
        setAuthenticated(false);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return <p className="py-2 text-sm text-slate-600">Checking your session...</p>;
  }

  if (!authenticated) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Log in required</h1>
        <p className="mt-2 text-sm text-slate-600">
          Please log in to access this page and use HealthSignal AI analysis tools and saved report history.
        </p>
        <Link
          className="mt-4 inline-flex rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          href="/auth"
        >
          Log In
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
