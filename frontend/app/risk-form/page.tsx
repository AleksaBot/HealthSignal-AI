import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";

export default function RiskFormPage() {
  return (
    <RequireAuth>
      <section className="section-shell space-y-5 p-6 md:p-8">
        <div className="premium-card space-y-4 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Workflow Update</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Risk Form has been replaced</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The previous Risk Form / Risk Screener flow is now split into two clearer product experiences:
            <strong> My Health Profile + Risk Insights</strong> for baseline interpretation, and <strong>Health Trends</strong> for longitudinal analytics.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/profile" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">
              Open My Health Profile
            </Link>
            <Link href="/health-trends" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              Open Health Trends
            </Link>
            <Link href="/symptom-analyzer" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              Start Symptom Analyzer
            </Link>
            <Link href="/history" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              Review Reports
            </Link>
          </div>
        </div>
      </section>
    </RequireAuth>
  );
}
