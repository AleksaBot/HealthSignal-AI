"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserErrorMessage, verifyEmailToken } from "@/lib/api";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Verification token is missing.");
      return;
    }

    verifyEmailToken(token)
      .then((response) => {
        setState("success");
        setMessage(response.message);
        router.replace("/auth?message=email-verified");
      })
      .catch((err) => {
        setState("error");
        setMessage(getUserErrorMessage(err, "Unable to verify email right now."));
      });
  }, [router, token]);

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Email verification</h1>
      <p
        className={`mt-3 rounded-lg border p-3 text-sm ${
          state === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200"
            : state === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-200"
              : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
        }`}
      >
        {message}
      </p>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Return to <Link href="/auth" className="font-medium text-brand-700 underline dark:text-brand-300">authentication</Link>.
      </p>
    </section>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"><p className="text-sm text-slate-600 dark:text-slate-300">Verifying...</p></section>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
