"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { getCurrentUser, isLoggedIn } from "@/lib/api";

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
    title: "Risk Form",
    description: "Run structured stroke, cardiometabolic, and chronic risk estimations in a transparent workflow.",
    href: "/risk-form",
    cta: "Run Risk Workflow"
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
        setFirstName(user.first_name);
      })
      .catch(() => {
        setFirstName(null);
      });
  }, []);

  return (
    <section className="relative isolate space-y-8 overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-2xl shadow-slate-300/35 backdrop-blur-sm md:p-10">
      <div className="pointer-events-none absolute -left-16 top-8 h-52 w-52 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-10 top-24 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />

      <div className="relative space-y-6">
        <p className="inline-flex rounded-full border border-brand-200 bg-brand-50/90 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-brand-700">
          Clinical Command Center
        </p>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">Premium clinical intelligence workspace.</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
              HealthSignal AI brings symptom analysis, note interpretation, and risk workflows into one polished environment designed for
              focused, educational decision support.
            </p>

            {authenticated ? (
              <div className="space-y-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
                <p className="text-sm font-medium text-emerald-800">
                  {firstName ? `Welcome back, ${firstName}.` : "Welcome back."} Your command center is ready.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/25 transition hover:-translate-y-0.5 hover:bg-brand-600"
                  >
                    Open Operations Dashboard
                  </Link>
                  <Link
                    href="/history"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"
                  >
                    Review Recent Reports
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
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>

          <div className="glass-panel animate-fade-in space-y-3 rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace Signal</p>
            <div className="space-y-2 text-sm text-slate-600">
              <p>• Educational support only, with transparent interpretation layers.</p>
              <p>• Designed for quick triage framing and longitudinal report review.</p>
              <p>• Secure authentication required for saved report workflows.</p>
            </div>
          </div>
        </div>
      </div>

      <DisclaimerBanner compact />

      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/60 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-100/50"
          >
            <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
            <p className="mt-4 text-sm font-medium text-brand-700 transition group-hover:translate-x-1">{card.cta} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
