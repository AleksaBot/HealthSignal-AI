"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";
import { getReport, getUserErrorMessage, listReports } from "@/lib/api";
import { ReportRead } from "@/lib/types";

function formatReportType(reportType: string) {
  return reportType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function HistoryPage() {
  const [reports, setReports] = useState<ReportRead[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<number | null>(null);
  const parsedInput = selectedReport ? parseJson(selectedReport.input_payload) : null;
  const parsedOutput = selectedReport ? parseJson(selectedReport.output_summary) : null;

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      setError(null);
      try {
        const response = await listReports();
        setReports(response);
      } catch (err) {
        setError(getUserErrorMessage(err, "Unable to load reports right now."));
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  async function viewReport(reportId: number) {
    setError(null);
    setLoadingReportId(reportId);
    try {
      const detail = await getReport(reportId);
      setSelectedReport(detail);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to load report details right now."));
    } finally {
      setLoadingReportId(null);
    }
  }

  return (
    <RequireAuth>
      <section className="section-shell space-y-6 p-6 md:p-8">
        <div className="ambient-orb -right-12 top-2 h-48 w-48 bg-brand-200/30" />
        <div className="ambient-orb -left-14 bottom-6 h-44 w-44 bg-cyan-200/30" />

        <header className="relative space-y-3 border-b border-slate-200/80 pb-5 dark:border-slate-700/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Reports Workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:text-[2.1rem]">Saved Reports</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
            Review prior analyses, reopen key findings, and inspect stored input/output details for continuity.
          </p>
        </header>
        <div className="relative">
          <DisclaimerBanner compact />
        </div>

        {loading ? <p className="relative text-sm text-slate-600 dark:text-slate-300">Loading reports...</p> : null}
        {error ? <p className="relative rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-sm text-rose-700 dark:border-rose-400/35 dark:bg-rose-900/25 dark:text-rose-200">{error}</p> : null}

        {!loading && reports.length === 0 ? (
          <div className="frosted-panel animate-fade-up relative mx-auto max-w-xl rounded-3xl p-8 text-center [--stagger:140ms]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-cyan-50 text-brand-700 shadow-md shadow-brand-100/60 dark:border-brand-400/30 dark:from-brand-900/40 dark:to-cyan-900/35 dark:text-brand-200 dark:shadow-brand-950/20">
              📄
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">No reports yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Completed analyses will appear here with report type and timestamp for longitudinal review.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-700/25 transition hover:-translate-y-0.5 hover:bg-brand-600"
              >
                Open Dashboard
              </Link>
              <Link
                href="/symptom-analyzer"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-brand-400/40"
              >
                Start New Analysis
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Report list</h2>
            <ul className="space-y-2">
              {reports.map((report, index) => {
                const isActive = selectedReport?.id === report.id;

                return (
                  <li
                    key={report.id}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className={`premium-card premium-card-interactive animate-fade-up p-4 ${
                      isActive ? "border-brand-300 ring-2 ring-brand-100 hover:border-brand-300 dark:border-brand-400/70 dark:ring-brand-500/20" : "border-slate-200/90"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Report #{report.id}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {formatReportType(report.report_type)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(report.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-brand-700/20 transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:opacity-60"
                        onClick={() => viewReport(report.id)}
                        disabled={loadingReportId === report.id}
                      >
                        {loadingReportId === report.id ? "Loading..." : "View details"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {selectedReport ? (
          <article className="frosted-panel animate-fade-up relative space-y-4 rounded-2xl p-5 [--stagger:120ms]">
            <header className="space-y-2 border-b border-slate-100 pb-3 dark:border-slate-700/70">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Report details</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Report #{selectedReport.id}</span>
                <span aria-hidden="true">•</span>
                <span>{formatReportType(selectedReport.report_type)}</span>
                <span aria-hidden="true">•</span>
                <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
              </div>
            </header>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Original input & metadata</h3>
              <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-slate-900/75 dark:text-slate-300">
                {JSON.stringify(parsedInput ?? selectedReport.input_payload, null, 2)}
              </pre>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Structured outputs</h3>
              <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-slate-900/75 dark:text-slate-300">
                {JSON.stringify(parsedOutput ?? selectedReport.output_summary, null, 2)}
              </pre>
            </section>
          </article>
        ) : null}
      </section>
    </RequireAuth>
  );
}
