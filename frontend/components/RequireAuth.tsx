"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/api";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    try {
      setAuthenticated(isLoggedIn());
    } finally {
      setReady(true);
    }
  }, []);

  if (!ready) {
    return <p className="py-2 text-sm text-slate-600">Loading...</p>;
  }

  if (!authenticated) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
        <p className="mb-2">You are not logged in. Please sign in to use this page.</p>
        <Link className="font-semibold text-brand-700 underline" href="/auth">
          Go to Auth
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
