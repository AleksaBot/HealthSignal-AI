"use client";

import { useEffect, useState } from "react";
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

export default function HistoryPage() {
  const [reports, setReports] = useState<ReportRead[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<number | null>(null);

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
      <section className="space-y-5">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Saved Reports</h1>
          <p className="text-sm text-slate-600">Review prior analyses and open a report to inspect stored input/output details.</p>
        </header>
        <DisclaimerBanner />

        {loading ? <p className="text-sm text-slate-600">Loading reports...</p> : null}
        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {!loading && reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No reports yet. Completed analyses will appear here with report type and timestamp.
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Report list</h2>
            <ul className="space-y-2">
              {reports.map((report) => {
                const isActive = selectedReport?.id === report.id;

                return (
                  <li
                    key={report.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                      isActive ? "border-brand-300 ring-1 ring-brand-200" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">Report #{report.id}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {formatReportType(report.report_type)}
                          </span>
                          <span className="text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        className="rounded-md bg-brand-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
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
          <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <header className="space-y-2 border-b border-slate-100 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">Report details</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>Report #{selectedReport.id}</span>
                <span aria-hidden="true">•</span>
                <span>{formatReportType(selectedReport.report_type)}</span>
                <span aria-hidden="true">•</span>
                <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
              </div>
            </header>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Input payload</h3>
              <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{selectedReport.input_payload}</pre>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Output summary</h3>
              <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{selectedReport.output_summary}</pre>
            </section>
          </article>
        ) : null}
      </section>
    </RequireAuth>
  );
}
