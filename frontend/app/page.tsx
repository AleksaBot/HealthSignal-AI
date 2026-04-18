"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { clearToken, getCurrentUser, isLoggedIn } from "@/lib/api";

const modules = [
  {
    title: "Symptom Analyzer",
    description: "Extract clinical signals, prioritize red flags, and convert free-text symptoms into structured observations.",
    href: "/symptom-analyzer",
    cta: "Launch Analyzer"
  },
  {
    title: "Note Interpreter",
    description: "Transform care notes into readable summaries with key findings, follow-up context, and decision-support framing.",
    href: "/note-interpreter",
    cta: "Interpret Notes"
  },
  {
    title: "Health Trends",
    description: "Review longitudinal snapshot patterns across your saved profile insights and report history.",
    href: "/health-trends",
    cta: "Open Trends"
  }
] as const;

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const loggedIn = isLoggedIn();
    setAuthenticated(loggedIn);

    if (!loggedIn) return;

    getCurrentUser()
      .then((user) => {
        setAuthenticated(true);
        setFirstName(user.first_name);
      })
      .catch(() => {
        setAuthenticated(false);
        clearToken();
        setFirstName(null);
      });
  }, []);

  return (
    <section className="section-shell space-y-8 p-6 md:p-10">
      <div className="ambient-orb -left-16 top-8 h-52 w-52 bg-brand-500/20" />
      <div className="ambient-orb -right-20 bottom-0 h-64 w-64 bg-cyan-200/35" />
      <div className="pointer-events-none absolute inset-x-10 top-24 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />

      <div className="relative space-y-6">
        <p className="inline-flex rounded-full border border-brand-200/80 bg-brand-50/85 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-brand-700 dark:border-sky-400/35 dark:bg-slate-900/65 dark:text-sky-300 dark:shadow-[0_0_0_1px_rgba(56,189,248,0.08),0_10px_24px_-18px_rgba(56,189,248,0.85)] dark:backdrop-blur-sm">
          Clinical Command Center
        </p>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">Premium clinical intelligence workspace.</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
              HealthSignal AI keeps your baseline profile, live Risk Insights interpretation, and longitudinal Health Trends in one polished environment.
            </p>

            {authenticated ? (
              <div className="space-y-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-400/30 dark:bg-emerald-900/20">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-100">
                  {firstName ? `Welcome back, ${firstName}.` : "Welcome back."} Your command center is ready.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/25 transition hover:-translate-y-0.5 hover:bg-brand-600"
                  >
                    Open Operations
                  </Link>
                  <Link
                    href="/profile"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-500"
                  >
                    Open My Health Profile
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/auth"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/20 transition hover:-translate-y-0.5 hover:bg-brand-600"
                >
                  Log In
                </Link>
                <Link
                  href="/auth?mode=signup"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-500"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>

          <div className="frosted-panel animate-fade-up space-y-3 rounded-2xl p-5 [--stagger:100ms]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Workspace Signal</p>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>• My Health Profile is your source-of-truth baseline.</p>
              <p>• Risk Insights are generated from your saved baseline profile.</p>
              <p>• Health Trends tracks longitudinal patterns across snapshots and reports.</p>
            </div>
          </div>
        </div>
      </div>

      <DisclaimerBanner compact />

      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((card, index) => (
          <Link
            key={card.title}
            href={card.href}
            style={{ animationDelay: `${140 + index * 70}ms` }}
            className="premium-card premium-card-interactive animate-fade-up group p-5"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
            <p className="mt-4 text-sm font-medium text-brand-700 transition group-hover:translate-x-1 dark:text-brand-300">{card.cta} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
