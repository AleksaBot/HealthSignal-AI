"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ThemeSelector } from "@/components/ThemeSelector";
import { clearToken, getCurrentUser, getUserErrorMessage, updateCurrentUserEmail, updateCurrentUserPassword } from "@/lib/api";
import { applyTheme, readStoredThemePreference, THEME_STORAGE_KEY, ThemePreference } from "@/lib/theme";

export default function SettingsPage() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [emailInput, setEmailInput] = useState("");
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("");
  const [currentPasswordForPassword, setCurrentPasswordForPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    const theme = readStoredThemePreference();
    setThemePreference(theme);

    getCurrentUser()
      .then((user) => setEmailInput(user.email))
      .catch(() => {
        // RequireAuth gate covers this flow.
      });
  }, []);

  function onSetTheme(nextTheme: ThemePreference) {
    setThemePreference(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  async function onChangeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailStatus(null);
    const cleanedEmail = emailInput.trim().toLowerCase();
    if (!cleanedEmail || !cleanedEmail.includes("@")) {
      setEmailStatus({ tone: "error", message: "Enter a valid email address." });
      return;
    }
    if (!currentPasswordForEmail.trim()) {
      setEmailStatus({ tone: "error", message: "Current password is required to change email." });
      return;
    }

    setUpdatingEmail(true);
    try {
      const updated = await updateCurrentUserEmail({ new_email: cleanedEmail, current_password: currentPasswordForEmail });
      setEmailInput(updated.email);
      setCurrentPasswordForEmail("");
      setEmailStatus({ tone: "success", message: "Email updated successfully." });
    } catch (err) {
      setEmailStatus({ tone: "error", message: getUserErrorMessage(err, "Unable to update email.") });
    } finally {
      setUpdatingEmail(false);
    }
  }

  async function onChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus(null);
    if (!currentPasswordForPassword.trim()) {
      setPasswordStatus({ tone: "error", message: "Current password is required." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ tone: "error", message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ tone: "error", message: "Password confirmation does not match." });
      return;
    }

    setUpdatingPassword(true);
    try {
      await updateCurrentUserPassword({ current_password: currentPasswordForPassword, new_password: newPassword });
      clearToken();
      window.location.assign("/auth?message=password-updated");
      return;
    } catch (err) {
      setPasswordStatus({ tone: "error", message: getUserErrorMessage(err, "Unable to update password.") });
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <RequireAuth>
      <section className="section-shell animate-fade-in p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Manage workspace preferences and account security. For identity name updates, use the Account page.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="premium-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Appearance</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Choose the theme for a comfortable clinical workspace.</p>
            <div className="mt-4">
              <ThemeSelector value={themePreference} onChange={onSetTheme} />
            </div>
          </article>

          <form className="premium-card space-y-3 rounded-2xl p-5" onSubmit={onChangeEmail}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Change email</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Update your sign-in email. Current password is required.</p>
            <input
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
            />
            <input
              type="password"
              value={currentPasswordForEmail}
              onChange={(event) => setCurrentPasswordForEmail(event.target.value)}
              placeholder="Current password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
            />
            <button
              type="submit"
              disabled={updatingEmail}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/20 transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingEmail ? "Updating..." : "Update email"}
            </button>
            {emailStatus ? (
              <p className={`rounded-lg border px-3 py-2 text-sm ${emailStatus.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"}`}>
                {emailStatus.message}
              </p>
            ) : null}
          </form>

          <form className="premium-card space-y-3 rounded-2xl p-5" onSubmit={onChangePassword}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Change password</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Keep your account secure with a strong new password.</p>
            <input
              type="password"
              value={currentPasswordForPassword}
              onChange={(event) => setCurrentPasswordForPassword(event.target.value)}
              placeholder="Current password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
            />
            <button
              type="submit"
              disabled={updatingPassword}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/20 transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingPassword ? "Updating..." : "Update password"}
            </button>
            {passwordStatus ? (
              <p className={`rounded-lg border px-3 py-2 text-sm ${passwordStatus.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"}`}>
                {passwordStatus.message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </RequireAuth>
  );
}
