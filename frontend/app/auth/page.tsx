"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserErrorMessage, login, saveToken, signup } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "signup") {
        setMode("signup");
      }
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        const user = await signup({ first_name: firstName, email, password });
        setMessage(`Account created for ${user.email}. You can now log in.`);
        setFirstName("");
        setMode("login");
      } else {
        const token = await login({ email, password });
        saveToken(token.access_token);
        setMessage("Log in successful. Redirecting to dashboard...");
        router.push("/");
      }
    } catch (err) {
      setError(getUserErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">{mode === "login" ? "Log In" : "Create Account"}</h1>
        <p className="text-sm text-slate-600">Use your account to run analyses and review saved reports.</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
        <button
          className={`rounded-md px-3 py-2 font-medium ${mode === "login" ? "bg-white text-brand-700 shadow-sm" : "text-slate-700"}`}
          onClick={() => setMode("login")}
          type="button"
        >
          Log In
        </button>
        <button
          className={`rounded-md px-3 py-2 font-medium ${mode === "signup" ? "bg-white text-brand-700 shadow-sm" : "text-slate-700"}`}
          onClick={() => setMode("signup")}
          type="button"
        >
          Create Account
        </button>
      </div>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <input
            className="w-full rounded-lg border border-slate-300 p-2.5"
            placeholder="First Name"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            maxLength={80}
          />
        ) : null}
        <input
          className="w-full rounded-lg border border-slate-300 p-2.5"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-slate-300 p-2.5"
          placeholder="Password (min 8 characters)"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
        <button
          className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "Submitting..." : mode === "login" ? "Log In" : "Create Account"}
        </button>
      </form>

      {message ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
