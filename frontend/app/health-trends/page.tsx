"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { getHealthProfile, getUserErrorMessage, listReports } from "@/lib/api";
import { buildHealthTrendsSummary } from "@/lib/healthTrends";
import { HealthProfile, ReportRead } from "@/lib/types";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function timelineTone(type: string) {
  if (type === "profile_snapshot") return "border-cyan-300/60 bg-cyan-50/70 text-cyan-800 dark:border-cyan-700/60 dark:bg-cyan-950/25 dark:text-cyan-200";
  if (type === "symptom_report") return "border-amber-300/60 bg-amber-50/70 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/25 dark:text-amber-200";
  if (type === "note_report") return "border-violet-300/60 bg-violet-50/70 text-violet-800 dark:border-violet-700/60 dark:bg-violet-950/25 dark:text-violet-200";
  return "border-slate-300/70 bg-slate-100/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200";
}

export default function HealthTrendsPage() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [reports, setReports] = useState<ReportRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [profileResponse, reportsResponse] = await Promise.all([getHealthProfile(), listReports()]);
        setProfile(profileResponse);
        setReports(reportsResponse);
      } catch (err) {
        setError(getUserErrorMessage(err, "Unable to load health trends right now."));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const summary = useMemo(() => buildHealthTrendsSummary(profile, reports), [profile, reports]);

  if (loading) {
    return (
      <RequireAuth>
        <section className="section-shell p-8">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading Health Trends...</p>
        </section>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <section className="section-shell space-y-6 p-6 md:p-8">
        <div className="ambient-orb -right-20 -top-10 h-44 w-44 bg-brand-300/20" />
        <div className="ambient-orb -bottom-20 left-0 h-56 w-56 bg-cyan-200/20" />

        <div className="relative space-y-3 border-b border-slate-200/80 pb-5 dark:border-slate-700/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Health Trends</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Longitudinal health trends dashboard</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Track how your saved health profile snapshots, Risk Insights reports, and related analyses change over time.
          </p>
        </div>

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        {!summary.hasHistory ? (
          <section className="premium-card space-y-4 p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No trend history yet</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Save your first profile insight snapshot to start tracking changes over time.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/profile" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">Open My Health Profile</Link>
              <Link href="/profile" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Refresh Risk Insights</Link>
              <Link href="/symptom-analyzer" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Start Symptom Check</Link>
              <Link href="/history" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Review Reports</Link>
            </div>
          </section>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summary.trendCards.map((card) => (
                <article key={card.label} className="premium-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="premium-card space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent snapshot timeline</h2>
                  <Link href="/history" className="text-sm font-medium text-brand-700 dark:text-brand-300">Open reports →</Link>
                </div>
                <div className="space-y-3">
                  {summary.timeline.length ? (
                    summary.timeline.map((item) => (
                      <article key={item.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${timelineTone(item.type)}`}>{item.type.replace("_", " ")}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(item.timestamp)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No reports available yet. Save a profile snapshot or run a workflow to begin.</p>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <article className="premium-card p-5">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Health pattern insights</h2>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                    {summary.patternInsights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </article>

                <article className="premium-card p-5">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Suggested actions</h2>
                  <div className="mt-3 grid gap-2">
                    <Link href="/profile" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Update My Health Profile</Link>
                    <Link href="/profile" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Refresh Risk Insights</Link>
                    <Link href="/history" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Review Reports</Link>
                    <Link href="/symptom-analyzer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Run Symptom Analyzer</Link>
                    <Link href="/note-interpreter" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Upload Clinician Note</Link>
                  </div>
                </article>
              </section>
            </div>
          </>
        )}
      </section>
    </RequireAuth>
  );
}
