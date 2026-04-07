"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserErrorMessage, login, saveToken, signup } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        const user = await signup({ email, password });
        setMessage(`Account created for ${user.email}. You can now log in.`);
      } else {
        const token = await login({ email, password });
        saveToken(token.access_token);
        setMessage("Login successful. Redirecting to dashboard...");
        router.push("/dashboard");
      }
    } catch (err) {
      setError(getUserErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Sign in" : "Create account"}</h1>
      <p className="text-sm text-slate-600">Use your account to run analyses and view saved reports.</p>
      <div className="flex gap-2 text-sm">
        <button
          className={`rounded-md px-3 py-1 ${mode === "login" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700"}`}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        <button
          className={`rounded-md px-3 py-1 ${mode === "signup" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700"}`}
          onClick={() => setMode("signup")}
          type="button"
        >
          Signup
        </button>
      </div>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border p-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border p-2"
          placeholder="Password (min 8 characters)"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
        <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={loading}>
          {loading ? "Submitting..." : mode === "login" ? "Continue" : "Create Account"}
        </button>
      </form>
      {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
