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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asFollowUpRows(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      question: typeof item.question === "string" ? item.question : "",
      answer: typeof item.answer === "string" ? item.answer : ""
    }))
    .filter((item) => item.question.trim().length > 0 || item.answer.trim().length > 0);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function ReportDataRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

function ReportChipList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [reports, setReports] = useState<ReportRead[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<number | null>(null);
  const parsedInput = selectedReport ? parseJson(selectedReport.input_payload) : null;
  const parsedOutput = selectedReport ? parseJson(selectedReport.output_summary) : null;
  const isSymptomGuided = selectedReport?.report_type === "symptom-intake-guided";
  const isNoteInterpreter = selectedReport?.report_type === "note-interpreter-text" || selectedReport?.report_type === "note-interpreter-file";

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

  const structuredData = asObject(parsedOutput?.structured_data);
  const outputs = asObject(parsedOutput?.outputs);
  const extracted = asObject(structuredData?.extracted);
  const interpretation = asObject(structuredData?.interpretation);
  const symptomFollowUps = asFollowUpRows(parsedOutput?.follow_up_qa);
  const noteFollowUps = asFollowUpRows(parsedOutput?.follow_up_qa);

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

            {isSymptomGuided ? (
              <div className="space-y-4">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Original symptom input</h3>
                  <p className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(parsedInput?.original_input_text) ?? "Not available."}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <ReportDataRow label="Saved timestamp" value={formatDate(parsedInput?.completed_at as string) ?? formatDate(selectedReport.created_at)} />
                    <ReportDataRow label="Risk level" value={stringValue(asObject(outputs?.risk_assessment)?.risk_level)} />
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Extracted symptoms</h3>
                  <ReportChipList items={asStringArray(extracted?.primary_symptoms)} />
                  <div className="grid gap-2 md:grid-cols-3">
                    <ReportDataRow label="Duration" value={stringValue(extracted?.duration)} />
                    <ReportDataRow label="Severity" value={stringValue(extracted?.severity)} />
                    <ReportDataRow label="Location" value={stringValue(extracted?.location_body_area)} />
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Triage recommendation</h3>
                  <p className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(outputs?.triage_recommendation) ?? "Not available."}
                  </p>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Likely categories</h4>
                  <ReportChipList items={asStringArray(structuredData?.categories)} />
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Follow-up Q&A</h3>
                  {symptomFollowUps.length > 0 ? (
                    <div className="space-y-2">
                      {symptomFollowUps.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Question</p>
                          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{item.question || "Not provided."}</p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Answer</p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{item.answer || "Not provided."}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                      No follow-up Q&A saved for this report.
                    </p>
                  )}
                </section>
              </div>
            ) : null}

            {isNoteInterpreter ? (
              <div className="space-y-4">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Original note input</h3>
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(parsedInput?.original_input_text) ?? "Not available."}
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h3>
                  <p className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(interpretation?.plain_english_summary) ?? "Not available."}
                  </p>
                </section>

                <section className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Medications / treatments</h3>
                    {Array.isArray(interpretation?.medicines_treatments) && interpretation?.medicines_treatments.length ? (
                      <ul className="space-y-2">
                        {(interpretation?.medicines_treatments as Array<Record<string, unknown>>).map((entry, idx) => (
                          <li key={`${String(entry.item)}-${idx}`} className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{stringValue(entry.item) ?? "Treatment"}</p>
                            <p className="mt-1">{stringValue(entry.explanation) ?? "No explanation provided."}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                        No medications or treatments captured.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Terms explained</h3>
                    {Array.isArray(interpretation?.medical_terms_explained) && interpretation?.medical_terms_explained.length ? (
                      <ul className="space-y-2">
                        {(interpretation?.medical_terms_explained as Array<Record<string, unknown>>).map((entry, idx) => (
                          <li key={`${String(entry.term)}-${idx}`} className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{stringValue(entry.term) ?? "Medical term"}</p>
                            <p className="mt-1">{stringValue(entry.plain_english) ?? "No explanation provided."}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                        No terms explained in this report.
                      </p>
                    )}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Suggested next steps</h3>
                  {asStringArray(interpretation?.next_steps).length ? (
                    <ul className="space-y-2">
                      {asStringArray(interpretation?.next_steps).map((step) => (
                        <li key={step} className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          {step}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                      No next-step guidance saved for this report.
                    </p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Follow-up chat Q&A</h3>
                  {noteFollowUps.length > 0 ? (
                    <div className="space-y-2">
                      {noteFollowUps.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Question</p>
                          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{item.question || "Not provided."}</p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Answer</p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{item.answer || "Not provided."}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                      No follow-up chat transcript saved for this report.
                    </p>
                  )}
                </section>
              </div>
            ) : null}

            {!isSymptomGuided && !isNoteInterpreter ? (
              <>
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
              </>
            ) : null}
          </article>
        ) : null}
      </section>
    </RequireAuth>
  );
}
