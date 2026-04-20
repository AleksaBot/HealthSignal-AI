"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserErrorMessage, resetPassword } from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({ token, new_password: newPassword });
      setMessage(response.message);
      router.push("/auth?message=password-updated");
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to reset password right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Set a new password</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Reset your account password securely using your email reset link.</p>
      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          placeholder="New password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={8}
        />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
        />
        <button className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white disabled:opacity-60" type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
      {message ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-200">{error}</p> : null}
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Return to <Link href="/auth" className="font-medium text-brand-700 underline dark:text-brand-300">login</Link>.
      </p>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"><p className="text-sm text-slate-600 dark:text-slate-300">Loading reset experience...</p></section>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
