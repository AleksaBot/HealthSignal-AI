"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forgotPassword,
  getUserErrorMessage,
  login,
  resendVerificationEmail,
  saveToken,
  signup
} from "@/lib/api";

type AuthMode = "login" | "signup" | "forgot-password";

const AUTH_MESSAGE_BY_KEY: Record<string, string> = {
  "password-updated": "Password updated successfully. Please sign in again.",
  "email-verified": "Email verified successfully. You can now continue with your account."
};

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [devVerificationLink, setDevVerificationLink] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
    if (params.get("mode") === "forgot-password") setMode("forgot-password");

    const messageKey = params.get("message");
    if (messageKey && AUTH_MESSAGE_BY_KEY[messageKey]) {
      setMessage(AUTH_MESSAGE_BY_KEY[messageKey]);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevResetLink(null);
    setDevVerificationLink(null);

    try {
      if (mode === "signup") {
        const user = await signup({ first_name: firstName, email, password });
        setMessage(`Account created for ${user.email}. Please verify your email (link delivery can be configured per environment).`);
        const verificationResponse = await resendVerificationEmail({ email });
        if (verificationResponse.dev_verification_link) {
          setDevVerificationLink(verificationResponse.dev_verification_link);
        }
        setFirstName("");
        setPassword("");
        setMode("login");
        return;
      }

      if (mode === "forgot-password") {
        const response = await forgotPassword({ email });
        setMessage(response.message);
        setDevResetLink(response.dev_reset_link ?? null);
        return;
      }

      const token = await login({ email, password });
      saveToken(token.access_token);
      setMessage("Log in successful. Redirecting to dashboard...");
      router.push("/");
    } catch (err) {
      const userMessage = getUserErrorMessage(err);
      setError(userMessage);
      if (userMessage.toLowerCase().includes("verify")) {
        setNeedsVerification(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResendVerification() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevVerificationLink(null);
    try {
      const response = await resendVerificationEmail({ email });
      setMessage(response.message);
      if (response.dev_verification_link) setDevVerificationLink(response.dev_verification_link);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to resend verification email right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {mode === "login" ? "Log In" : mode === "signup" ? "Create Account" : "Reset Password"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Secure access for your dashboard, reports, and personal health workflows.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        <button
          className={`rounded-md px-3 py-2 font-medium ${
            mode === "login" ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200" : "text-slate-700 dark:text-slate-300"
          }`}
          onClick={() => setMode("login")}
          type="button"
        >
          Log In
        </button>
        <button
          className={`rounded-md px-3 py-2 font-medium ${
            mode === "signup" ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200" : "text-slate-700 dark:text-slate-300"
          }`}
          onClick={() => setMode("signup")}
          type="button"
        >
          Create Account
        </button>
        <button
          className={`rounded-md px-3 py-2 font-medium ${
            mode === "forgot-password" ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200" : "text-slate-700 dark:text-slate-300"
          }`}
          onClick={() => setMode("forgot-password")}
          type="button"
        >
          Forgot
        </button>
      </div>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <input
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="First Name"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            maxLength={80}
          />
        ) : null}
        <input
          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {mode !== "forgot-password" ? (
          <input
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Password (min 8 characters)"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        ) : null}
        <button
          className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Submitting..."
            : mode === "login"
              ? "Log In"
              : mode === "signup"
                ? "Create Account"
                : "Send reset link"}
        </button>
      </form>

      <div className="mt-3 flex justify-between text-xs">
        <button
          type="button"
          onClick={() => setMode("forgot-password")}
          className="font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          Forgot password?
        </button>
        {mode !== "login" ? (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="font-medium text-slate-600 hover:underline dark:text-slate-300"
          >
            Back to login
          </button>
        ) : null}
      </div>

      {needsVerification ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
          <p>Your email may need verification before full account trust features are enabled.</p>
          <button type="button" onClick={onResendVerification} className="mt-2 font-semibold text-amber-900 underline dark:text-amber-100">
            Resend verification email
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-200">{error}</p> : null}

      {devResetLink ? (
        <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-200">
          Development preview reset link:{" "}
          <a className="font-semibold underline" href={devResetLink}>
            Open reset page
          </a>
        </p>
      ) : null}

      {devVerificationLink ? (
        <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800 dark:border-indigo-700/40 dark:bg-indigo-900/20 dark:text-indigo-200">
          Development preview verification link:{" "}
          <a className="font-semibold underline" href={devVerificationLink}>
            Verify email
          </a>
        </p>
      ) : null}
    </section>
  );
}
