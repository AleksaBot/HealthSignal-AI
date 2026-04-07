"use client";

import { useEffect, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";
import { getReport, getUserErrorMessage, listReports } from "@/lib/api";
import { ReportRead } from "@/lib/types";

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
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Saved Reports</h1>
        <DisclaimerBanner />

        {loading ? <p className="text-sm text-slate-600">Loading reports...</p> : null}
        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {!loading && reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No reports yet. Generated analyses will appear here with timestamps and report type.
          </div>
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => (
              <li key={report.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-medium text-slate-900">{report.report_type}</p>
                  <p className="text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</p>
                </div>
                <button
                  className="rounded-md bg-brand-700 px-3 py-1 text-sm text-white disabled:opacity-60"
                  onClick={() => viewReport(report.id)}
                  disabled={loadingReportId === report.id}
                >
                  {loadingReportId === report.id ? "Loading..." : "View"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedReport ? (
          <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Report #{selectedReport.id}</h2>
            <p className="text-sm text-slate-600">Type: {selectedReport.report_type}</p>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Input Payload</h3>
              <pre className="mt-1 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{selectedReport.input_payload}</pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Output Summary</h3>
              <pre className="mt-1 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{selectedReport.output_summary}</pre>
            </div>
          </article>
        ) : null}
      </section>
    </RequireAuth>
  );
}
