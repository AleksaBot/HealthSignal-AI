"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { clearToken, getCurrentUser, getUserErrorMessage, resendVerificationEmail, updateCurrentUserName } from "@/lib/api";

type AccountState = {
  first_name: string;
  email: string;
  email_verified: boolean;
};

export default function AccountPage() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccount() {
      setLoading(true);
      setError(null);
      try {
        const response = await getCurrentUser();
        setAccount({
          first_name: response.first_name,
          email: response.email,
          email_verified: response.email_verified
        });
        setNameInput(response.first_name);
      } catch (err) {
        clearToken();
        setError(getUserErrorMessage(err, "Unable to load account details."));
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  async function onSaveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setFeedback({ tone: "error", message: "Name is required." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateCurrentUserName({ first_name: trimmedName });
      setAccount({ first_name: updated.first_name, email: updated.email, email_verified: updated.email_verified });
      setNameInput(updated.first_name);
      setFeedback({ tone: "success", message: "Your display name was updated." });
    } catch (err) {
      setFeedback({ tone: "error", message: getUserErrorMessage(err, "Unable to update your name right now.") });
    } finally {
      setSaving(false);
    }
  }

  async function onResendVerification() {
    if (!account) return;
    try {
      const response = await resendVerificationEmail({ email: account.email });
      setVerificationMessage(response.message);
    } catch (err) {
      setVerificationMessage(getUserErrorMessage(err, "Unable to resend verification link."));
    }
  }

  return (
    <RequireAuth>
      <section className="section-shell animate-fade-in space-y-6 p-8">
        <div className="space-y-2 border-b border-slate-200/80 pb-4 dark:border-slate-700/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Account</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Identity details</h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Account is your identity page. Update your display name here. For email, password, and security updates, use Settings.
          </p>
        </div>

        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading account...</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        {account ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <form className="premium-card space-y-4 p-5" onSubmit={onSaveName}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">First name</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Shown across your dashboard and reports.</p>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Display name</span>
                <input
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  maxLength={80}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/20 transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save display name"}
              </button>
              {feedback ? (
                <p
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    feedback.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"
                  }`}
                >
                  {feedback.message}
                </p>
              ) : null}
            </form>
            <article className="premium-card space-y-3 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</h2>
              <p className="text-base font-medium text-slate-900 dark:text-slate-100">{account.email}</p>
              <p className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${account.email_verified ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200"}`}>
                {account.email_verified ? "Verified" : "Verification pending"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Email is read-only on Account. Go to Settings to change your email or password.
              </p>
              {!account.email_verified ? (
                <button
                  type="button"
                  onClick={onResendVerification}
                  className="w-fit rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-600/50 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/50"
                >
                  Resend verification
                </button>
              ) : null}
              {verificationMessage ? <p className="text-xs text-slate-600 dark:text-slate-300">{verificationMessage}</p> : null}
            </article>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">Return to Dashboard</Link>
          <Link
            href="/settings"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500"
          >
            Manage security in Settings
          </Link>
        </div>
      </section>
    </RequireAuth>
  );
}
