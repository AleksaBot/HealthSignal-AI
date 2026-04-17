"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";
import { getReport, getUserErrorMessage, listReports } from "@/lib/api";
import { ReportRead } from "@/lib/types";

type FollowUpRow = { question: string; answer: string };

type ParsedReportContext = {
  parsedInput: Record<string, unknown> | null;
  parsedOutput: Record<string, unknown> | null;
  structuredData: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  extracted: Record<string, unknown> | null;
  interpretation: Record<string, unknown> | null;
  followUps: FollowUpRow[];
};

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

function asFollowUpRows(value: unknown): FollowUpRow[] {
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

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeSymptomLabel(value: string) {
  const cleaned = value.replace(/[_-]/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  return toTitleCase(cleaned);
}

function formatReportType(reportType: string) {
  const dictionary: Record<string, string> = {
    "symptom-intake-guided": "Symptom-Guided",
    "note-interpreter-text": "Note Interpreter",
    "note-interpreter-file": "Note Interpreter (Upload)"
  };
  if (dictionary[reportType]) return dictionary[reportType];
  return reportType
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseReportContext(report: ReportRead): ParsedReportContext {
  const parsedInput = parseJson(report.input_payload);
  const parsedOutput = parseJson(report.output_summary);
  const structuredData = asObject(parsedOutput?.structured_data);
  const outputs = asObject(parsedOutput?.outputs);
  const extracted = asObject(structuredData?.extracted);
  const interpretation = asObject(structuredData?.interpretation);
  const followUps = asFollowUpRows(parsedOutput?.follow_up_qa);

  return { parsedInput, parsedOutput, structuredData, outputs, extracted, interpretation, followUps };
}

function getRiskLevel(context: ParsedReportContext) {
  const outputsRisk = stringValue(asObject(context.outputs?.risk_assessment)?.risk_level);
  const extractedRisk = stringValue(context.extracted?.risk_level);
  const level = outputsRisk ?? extractedRisk;
  return level ? toTitleCase(level) : null;
}

function getDetectedSymptoms(context: ParsedReportContext) {
  return asStringArray(context.extracted?.primary_symptoms)
    .map((item) => normalizeSymptomLabel(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);
}

function getReportDisplayTitle(report: ReportRead, context: ParsedReportContext) {
  const detectedSymptoms = getDetectedSymptoms(context);
  const triage = stringValue(context.outputs?.triage_recommendation)?.toLowerCase() ?? "";

  if (report.report_type === "symptom-intake-guided") {
    const [first, second] = detectedSymptoms;
    const hasRespiratory = detectedSymptoms.some((symptom) =>
      /(cough|breath|respir|chest congestion|wheeze|sore throat|runny nose)/i.test(symptom)
    );
    const hasChestPain = detectedSymptoms.some((symptom) => /chest pain/i.test(symptom));

    if (hasChestPain) return "Chest Pain Guidance Report";
    if (hasRespiratory) return "Respiratory Symptom Intake";
    if (first && second) return `${first} + ${second} Assessment`;
    if (first) return `${first} Guidance Report`;
    if (triage.includes("follow")) return "Symptom Follow-up Summary";
    return "Symptom Intake Report";
  }

  if (report.report_type === "note-interpreter-file") {
    return "Uploaded Doctor Note Interpretation";
  }

  if (report.report_type === "note-interpreter-text") {
    const sourceText = stringValue(context.parsedInput?.original_input_text) ?? "";
    if (/follow[- ]?up/i.test(sourceText)) return "Follow-up Note Review";
    if (/appointment/i.test(sourceText)) return "Appointment Note Summary";
    return "Doctor Note Interpretation";
  }

  return `Report #${report.id}`;
}

function getHeaderSummary(report: ReportRead, context: ParsedReportContext, reportTitle: string) {
  if (report.report_type === "symptom-intake-guided") {
    const symptoms = getDetectedSymptoms(context);
    const riskLevel = getRiskLevel(context);
    const symptomText = symptoms.length ? symptoms.slice(0, 2).join(" and ").toLowerCase() : "reported symptoms";
    if (riskLevel) return `${riskLevel} risk symptom assessment for ${symptomText}.`;
    return `Symptom assessment report for ${symptomText}.`;
  }

  if (report.report_type === "note-interpreter-text" || report.report_type === "note-interpreter-file") {
    const summary = stringValue(context.interpretation?.plain_english_summary);
    if (summary) return summary;
    return report.report_type === "note-interpreter-file"
      ? "Doctor note summary generated from uploaded document input."
      : "Doctor note summary with key findings and follow-up guidance.";
  }

  return `${reportTitle} saved for longitudinal review.`;
}

function mapRiskTone(level: string | null) {
  if (!level) return "border-slate-300/80 bg-slate-100/80 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
  if (/high|urgent|emergency|severe/i.test(level)) return "border-rose-300/60 bg-rose-100/80 text-rose-700 dark:border-rose-400/40 dark:bg-rose-900/30 dark:text-rose-200";
  if (/moderate|medium/i.test(level)) return "border-amber-300/60 bg-amber-100/80 text-amber-700 dark:border-amber-400/35 dark:bg-amber-900/30 dark:text-amber-200";
  return "border-emerald-300/60 bg-emerald-100/80 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-900/30 dark:text-emerald-200";
}

function deriveSymptomNextSteps(context: ParsedReportContext): string[] {
  const riskLevel = getRiskLevel(context)?.toLowerCase() ?? "";
  const triage = stringValue(context.outputs?.triage_recommendation);
  const followups = asStringArray(context.structuredData?.follow_up_questions);
  const steps: string[] = [];

  if (triage) steps.push(triage);

  if (riskLevel.includes("high") || /urgent|emergency/.test((triage ?? "").toLowerCase())) {
    steps.push("Seek urgent in-person care right away if symptoms worsen or red-flag symptoms appear.");
  } else if (riskLevel.includes("moderate")) {
    steps.push("Arrange outpatient clinician follow-up to review symptom progression.");
    steps.push("Monitor symptoms over the next 24 hours and note any new changes.");
  } else {
    steps.push("Continue symptom monitoring and keep a concise timeline for your clinician.");
  }

  if (followups.length > 0) {
    steps.push("Prepare answers to follow-up questions before your next care touchpoint.");
  }

  return [...new Set(steps)].slice(0, 5);
}

function buildCopySummary(report: ReportRead, context: ParsedReportContext, reportTitle: string) {
  const savedAt = formatDate(stringValue(context.parsedInput?.completed_at) ?? report.created_at) ?? "Unknown";

  if (report.report_type === "symptom-intake-guided") {
    const risk = getRiskLevel(context) ?? "Not specified";
    const symptoms = getDetectedSymptoms(context);
    const triage = stringValue(context.outputs?.triage_recommendation) ?? "Not specified";
    const categories = asStringArray(context.structuredData?.categories);

    return [
      `Title: ${reportTitle}`,
      `Saved: ${savedAt}`,
      `Risk level: ${risk}`,
      `Detected symptoms: ${symptoms.length ? symptoms.join(", ") : "Not specified"}`,
      `Triage recommendation: ${triage}`,
      `Likely categories: ${categories.length ? categories.join(", ") : "Not specified"}`
    ].join("\n");
  }

  if (report.report_type === "note-interpreter-text" || report.report_type === "note-interpreter-file") {
    const summary = stringValue(context.interpretation?.plain_english_summary) ?? "Not specified";
    const meds = (Array.isArray(context.interpretation?.medicines_treatments) ? context.interpretation?.medicines_treatments : []) as Array<Record<string, unknown>>;
    const medNames = meds.map((entry) => stringValue(entry.item)).filter((item): item is string => Boolean(item));
    const nextSteps = asStringArray(context.interpretation?.next_steps);

    return [
      `Title: ${reportTitle}`,
      `Saved: ${savedAt}`,
      `Summary: ${summary}`,
      `Medicines / treatments: ${medNames.length ? medNames.join(", ") : "Not specified"}`,
      `Next steps: ${nextSteps.length ? nextSteps.join("; ") : "Not specified"}`
    ].join("\n");
  }

  return `Title: ${reportTitle}\nSaved: ${savedAt}`;
}

function ReportDataRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
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
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-slate-700/80 dark:bg-slate-900/65">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{title}</h3>
      {children}
    </section>
  );
}

export default function HistoryPage() {
  const [reports, setReports] = useState<ReportRead[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");

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
    setCopyStatus("idle");
    try {
      const detail = await getReport(reportId);
      setSelectedReport(detail);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to load report details right now."));
    } finally {
      setLoadingReportId(null);
    }
  }

  const selectedContext = useMemo(() => (selectedReport ? parseReportContext(selectedReport) : null), [selectedReport]);
  const isSymptomGuided = selectedReport?.report_type === "symptom-intake-guided";
  const isNoteInterpreter = selectedReport?.report_type === "note-interpreter-text" || selectedReport?.report_type === "note-interpreter-file";

  const selectedTitle = selectedReport && selectedContext ? getReportDisplayTitle(selectedReport, selectedContext) : null;
  const selectedRisk = selectedContext ? getRiskLevel(selectedContext) : null;
  const selectedHeaderSummary = selectedReport && selectedContext && selectedTitle ? getHeaderSummary(selectedReport, selectedContext, selectedTitle) : null;

  const symptomNextSteps = selectedContext ? deriveSymptomNextSteps(selectedContext) : [];

  async function copySummary() {
    if (!selectedReport || !selectedContext || !selectedTitle) return;

    try {
      await navigator.clipboard.writeText(buildCopySummary(selectedReport, selectedContext, selectedTitle));
      setCopyStatus("success");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
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
            Review prior analyses, reopen key findings, and inspect clinically shareable summaries.
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
            <ul className="space-y-3">
              {reports.map((report, index) => {
                const isActive = selectedReport?.id === report.id;
                const context = parseReportContext(report);
                const title = getReportDisplayTitle(report, context);
                const summary = getHeaderSummary(report, context, title);
                const risk = getRiskLevel(context);
                const reportTime = formatDate(stringValue(context.parsedInput?.completed_at) ?? report.created_at) ?? "Unknown";

                return (
                  <li
                    key={report.id}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className={`premium-card premium-card-interactive animate-fade-up p-4 ${
                      isActive ? "border-brand-300 ring-2 ring-brand-100 hover:border-brand-300 dark:border-brand-400/70 dark:ring-brand-500/20" : "border-slate-200/90"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{summary}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {formatReportType(report.report_type)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{reportTime}</span>
                          {risk ? <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${mapRiskTone(risk)}`}>{risk} Risk</span> : null}
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

        {selectedReport && selectedContext && selectedTitle ? (
          <article className="frosted-panel animate-fade-up relative space-y-4 rounded-2xl p-5 [--stagger:120ms]">
            <header className="space-y-3 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-white/95 via-white/90 to-brand-50/80 p-4 shadow-sm shadow-brand-200/25 dark:border-brand-500/30 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-brand-950/30 dark:shadow-brand-900/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Report detail</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{selectedTitle}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{formatReportType(selectedReport.report_type)}</span>
                  {selectedRisk ? <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${mapRiskTone(selectedRisk)}`}>{selectedRisk} Risk</span> : null}
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{selectedHeaderSummary}</p>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3 text-xs text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
                <span>Completed: {formatDate(stringValue(selectedContext.parsedInput?.completed_at) ?? selectedReport.created_at) ?? "Unknown"}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-brand-300/70 bg-white/90 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 dark:border-brand-400/50 dark:bg-slate-900/70 dark:text-brand-200 dark:hover:border-brand-300"
                    onClick={copySummary}
                  >
                    Copy Summary
                  </button>
                  <button
                    className="cursor-not-allowed rounded-lg border border-slate-300/80 bg-slate-100/90 px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400"
                    disabled
                    title="PDF export is coming soon"
                  >
                    Download PDF (Coming soon)
                  </button>
                </div>
              </div>
              {copyStatus === "success" ? <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">Summary copied to clipboard.</p> : null}
              {copyStatus === "error" ? <p className="text-xs font-medium text-rose-600 dark:text-rose-300">Unable to copy summary right now.</p> : null}
            </header>

            {isSymptomGuided ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <SectionCard title="Original Symptom Input">
                  <p className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(selectedContext.parsedInput?.original_input_text) ?? "Not available."}
                  </p>
                </SectionCard>

                <SectionCard title="Key Summary">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{selectedHeaderSummary}</p>
                </SectionCard>

                <SectionCard title="Risk & Triage">
                  <div className="space-y-2">
                    <ReportDataRow label="Risk level" value={selectedRisk} />
                    <p className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                      {stringValue(selectedContext.outputs?.triage_recommendation) ?? "Not available."}
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Detected Symptoms">
                  <ReportChipList items={getDetectedSymptoms(selectedContext)} />
                </SectionCard>

                <SectionCard title="Duration / Severity / Body Area">
                  <div className="grid gap-2 md:grid-cols-3">
                    <ReportDataRow label="Duration" value={stringValue(selectedContext.extracted?.duration)} />
                    <ReportDataRow label="Severity" value={stringValue(selectedContext.extracted?.severity)} />
                    <ReportDataRow label="Body area" value={stringValue(selectedContext.extracted?.location_body_area)} />
                  </div>
                </SectionCard>

                <SectionCard title="Likely Categories">
                  <ReportChipList items={asStringArray(selectedContext.structuredData?.categories)} />
                </SectionCard>

                <SectionCard title="Recommended Next Steps">
                  {symptomNextSteps.length ? (
                    <ul className="space-y-2">
                      {symptomNextSteps.map((step) => (
                        <li key={step} className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          {step}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No next-step guidance saved for this report.</p>
                  )}
                </SectionCard>

                <SectionCard title="Follow-up Q&A">
                  {selectedContext.followUps.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContext.followUps.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Question</p>
                          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{item.question || "Not provided."}</p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Answer</p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{item.answer || "Not provided."}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No follow-up Q&A saved for this report.</p>
                  )}
                </SectionCard>

                <SectionCard title="Saved Timestamp / Metadata">
                  <div className="grid gap-2 md:grid-cols-2">
                    <ReportDataRow label="Saved timestamp" value={formatDate(stringValue(selectedContext.parsedInput?.completed_at) ?? selectedReport.created_at)} />
                    <ReportDataRow label="Report type" value={formatReportType(selectedReport.report_type)} />
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {isNoteInterpreter ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <SectionCard title="Original Note Input">
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(selectedContext.parsedInput?.original_input_text) ?? "Not available."}
                  </p>
                </SectionCard>

                <SectionCard title="Plain-English Summary">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{stringValue(selectedContext.interpretation?.plain_english_summary) ?? "Not available."}</p>
                </SectionCard>

                <SectionCard title="Medicines / Treatments Mentioned">
                  {Array.isArray(selectedContext.interpretation?.medicines_treatments) && selectedContext.interpretation?.medicines_treatments.length ? (
                    <ul className="space-y-2">
                      {(selectedContext.interpretation?.medicines_treatments as Array<Record<string, unknown>>).map((entry, idx) => (
                        <li key={`${String(entry.item)}-${idx}`} className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{stringValue(entry.item) ?? "Treatment"}</p>
                          <p className="mt-1">{stringValue(entry.explanation) ?? "No explanation provided."}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No medications or treatments captured.</p>
                  )}
                </SectionCard>

                <SectionCard title="Medical Terms Explained">
                  {Array.isArray(selectedContext.interpretation?.medical_terms_explained) && selectedContext.interpretation?.medical_terms_explained.length ? (
                    <ul className="space-y-2">
                      {(selectedContext.interpretation?.medical_terms_explained as Array<Record<string, unknown>>).map((entry, idx) => (
                        <li key={`${String(entry.term)}-${idx}`} className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{stringValue(entry.term) ?? "Medical term"}</p>
                          <p className="mt-1">{stringValue(entry.plain_english) ?? "No explanation provided."}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No terms explained in this report.</p>
                  )}
                </SectionCard>

                <SectionCard title="Suggested Next Steps">
                  {asStringArray(selectedContext.interpretation?.next_steps).length ? (
                    <ul className="space-y-2">
                      {asStringArray(selectedContext.interpretation?.next_steps).map((step) => (
                        <li key={step} className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          {step}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No next-step guidance saved for this report.</p>
                  )}
                </SectionCard>

                <SectionCard title="Follow-up Q&A">
                  {selectedContext.followUps.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContext.followUps.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Question</p>
                          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{item.question || "Not provided."}</p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Answer</p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{item.answer || "Not provided."}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No follow-up chat transcript saved for this report.</p>
                  )}
                </SectionCard>

                <SectionCard title="Saved Timestamp / Metadata">
                  <div className="grid gap-2 md:grid-cols-2">
                    <ReportDataRow label="Saved timestamp" value={formatDate(stringValue(selectedContext.parsedInput?.completed_at) ?? selectedReport.created_at)} />
                    <ReportDataRow label="Report type" value={formatReportType(selectedReport.report_type)} />
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {!isSymptomGuided && !isNoteInterpreter ? (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Original input & metadata</h3>
                  <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-slate-900/75 dark:text-slate-300">
                    {JSON.stringify(selectedContext.parsedInput ?? selectedReport.input_payload, null, 2)}
                  </pre>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Structured outputs</h3>
                  <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-slate-900/75 dark:text-slate-300">
                    {JSON.stringify(selectedContext.parsedOutput ?? selectedReport.output_summary, null, 2)}
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
