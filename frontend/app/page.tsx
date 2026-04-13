"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { getCurrentUser, isLoggedIn } from "@/lib/api";

const cards = [
  {
    title: "Symptom Analyzer",
    description: "Enter symptoms in plain English to extract clinical signals and highlight potential red flags.",
    href: "/symptom-analyzer"
  },
  {
    title: "Note Interpreter",
    description: "Paste visit summaries or clinician notes and get structured interpretation and explainable insights.",
    href: "/note-interpreter"
  },
  {
    title: "Risk Form",
    description: "Submit structured health data to generate stroke, diabetes, and cardiovascular risk insights.",
    href: "/risk-form"
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
    <section className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">HealthSignal AI</h1>
        <p className="max-w-2xl text-slate-600">
          A health intelligence workspace for educational decision support, signal extraction, and risk insights.
        </p>
        {authenticated ? (
          <>
            <p className="text-sm font-medium text-brand-700">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/dashboard" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                Go to Dashboard
              </Link>
              <Link
                href="/history"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Reports
              </Link>
              <Link
                href="/symptom-analyzer"
                className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                Start Analysis
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">Log in to analyze symptoms, interpret notes, and save reports.</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/auth" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                Log In
              </Link>
              <Link
                href="/auth?mode=signup"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Create Account
              </Link>
            </div>
          </>
        )}
      </div>
      <DisclaimerBanner />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-brand-700">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
