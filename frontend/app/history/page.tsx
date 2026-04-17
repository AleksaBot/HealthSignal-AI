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

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatRelativeDate(value: string | null | undefined) {
  const date = toDate(value);
  if (!date) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfInput = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startOfToday.getTime() - startOfInput.getTime();
  const dayDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago`;
  if (dayDiff >= 7 && dayDiff < 31) return `${Math.floor(dayDiff / 7)} week${Math.floor(dayDiff / 7) > 1 ? "s" : ""} ago`;
  if (dayDiff >= 31) return `${Math.floor(dayDiff / 30)} month${Math.floor(dayDiff / 30) > 1 ? "s" : ""} ago`;
  return "Recently";
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
  if (!level) return "border-slate-300/90 bg-slate-100/90 text-slate-700 shadow-slate-300/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:shadow-slate-900/30";
  if (/emergency|critical/i.test(level)) return "border-rose-400/90 bg-rose-100 text-rose-800 shadow-[0_0_0_1px_rgba(244,63,94,0.4),0_8px_20px_rgba(244,63,94,0.18)] dark:border-rose-300/60 dark:bg-rose-900/45 dark:text-rose-100 dark:shadow-[0_0_0_1px_rgba(253,164,175,0.35),0_8px_20px_rgba(225,29,72,0.3)]";
  if (/high|urgent|severe/i.test(level)) return "border-orange-400/90 bg-orange-100 text-orange-800 shadow-[0_0_0_1px_rgba(251,146,60,0.36),0_8px_20px_rgba(249,115,22,0.15)] dark:border-orange-300/55 dark:bg-orange-900/40 dark:text-orange-100 dark:shadow-[0_0_0_1px_rgba(253,186,116,0.28),0_8px_20px_rgba(234,88,12,0.28)]";
  if (/moderate|medium/i.test(level)) return "border-amber-400/90 bg-amber-100 text-amber-900 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_20px_rgba(245,158,11,0.16)] dark:border-amber-300/55 dark:bg-amber-900/40 dark:text-amber-100 dark:shadow-[0_0_0_1px_rgba(252,211,77,0.28),0_8px_20px_rgba(180,83,9,0.28)]";
  return "border-emerald-400/90 bg-emerald-100 text-emerald-900 shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_8px_20px_rgba(5,150,105,0.14)] dark:border-emerald-300/55 dark:bg-emerald-900/40 dark:text-emerald-100 dark:shadow-[0_0_0_1px_rgba(110,231,183,0.28),0_8px_20px_rgba(5,150,105,0.3)]";
}

function getRiskLabel(level: string | null) {
  if (!level) return "Low";
  if (/emergency|critical/i.test(level)) return "Emergency";
  if (/high|urgent|severe/i.test(level)) return "High";
  if (/moderate|medium/i.test(level)) return "Moderate";
  return "Low";
}

function getUrgencyScore(report: ReportRead, context: ParsedReportContext) {
  if (report.report_type !== "symptom-intake-guided") return null;

  const riskLabel = getRiskLabel(getRiskLevel(context));
  const symptomCount = getDetectedSymptoms(context).length;
  const triage = stringValue(context.outputs?.triage_recommendation)?.toLowerCase() ?? "";
  const severity = stringValue(context.extracted?.severity)?.toLowerCase() ?? "";
  const duration = stringValue(context.extracted?.duration)?.toLowerCase() ?? "";

  let score = 22;
  if (riskLabel === "Moderate") score = 55;
  if (riskLabel === "High") score = 79;
  if (riskLabel === "Emergency") score = 93;

  score += Math.min(symptomCount * 2, 8);
  if (/severe|worst|extreme/.test(severity)) score += 8;
  else if (/moderate/.test(severity)) score += 4;

  if (/week|month|persistent|ongoing/.test(duration)) score += 3;
  if (/urgent|er|emergency|immediate|call 911/.test(triage)) score += 6;

  const ranges: Record<string, [number, number]> = {
    Low: [10, 35],
    Moderate: [40, 69],
    High: [70, 89],
    Emergency: [90, 100]
  };
  const [min, max] = ranges[riskLabel];
  return { score: Math.min(max, Math.max(min, score)), riskLabel };
}

function getUrgencyMeterTone(riskLabel: string) {
  if (riskLabel === "Emergency") {
    return "from-rose-500 to-red-600 shadow-rose-500/35 dark:from-rose-400 dark:to-red-500";
  }
  if (riskLabel === "High") {
    return "from-orange-400 to-orange-600 shadow-orange-500/35 dark:from-orange-400 dark:to-orange-500";
  }
  if (riskLabel === "Moderate") {
    return "from-amber-300 to-amber-500 shadow-amber-500/30 dark:from-amber-300 dark:to-amber-500";
  }
  return "from-emerald-400 to-emerald-600 shadow-emerald-500/30 dark:from-emerald-400 dark:to-emerald-500";
}

function getConfidenceLabel(context: ParsedReportContext) {
  const checks = [
    getDetectedSymptoms(context).length > 0,
    Boolean(stringValue(context.extracted?.duration)),
    Boolean(stringValue(context.extracted?.severity)),
    Boolean(stringValue(context.extracted?.location_body_area)),
    Boolean(stringValue(context.outputs?.triage_recommendation)),
    asStringArray(context.structuredData?.categories).length > 0,
    context.followUps.length > 0
  ];
  const score = checks.filter(Boolean).length;

  if (score >= 6) return "Moderate";
  if (score >= 4) return "Preliminary";
  return "Limited";
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return null;
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-opacity duration-300 ${mapRiskTone(risk)}`}>{getRiskLabel(risk)} Risk</span>;
}

function UrgencyChip({ report, context, mini = false }: { report: ReportRead; context: ParsedReportContext; mini?: boolean }) {
  const urgency = getUrgencyScore(report, context);
  if (!urgency) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-violet-300/70 bg-violet-100/90 font-semibold text-violet-800 shadow-sm shadow-violet-300/25 dark:border-violet-300/45 dark:bg-violet-900/35 dark:text-violet-100 dark:shadow-violet-950/30 ${
        mini ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-xs"
      }`}
    >
      <span>⏱</span>
      {urgency.riskLabel} Risk • {urgency.score} / 100
    </span>
  );
}

function UrgencyMeter({ report, context, compact = false }: { report: ReportRead; context: ParsedReportContext; compact?: boolean }) {
  const urgency = getUrgencyScore(report, context);
  if (!urgency) return null;
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/70 ${compact ? "w-full max-w-[220px]" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <span>Urgency Score</span>
        <span>{urgency.score} / 100</span>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-slate-200/90 dark:bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r shadow-md transition-all duration-500 ${getUrgencyMeterTone(urgency.riskLabel)}`}
          style={{ width: `${urgency.score}%` }}
        />
      </div>
    </div>
  );
}

function deriveImmediateCareGuidance(context: ParsedReportContext) {
  const risk = getRiskLabel(getRiskLevel(context));
  const triage = stringValue(context.outputs?.triage_recommendation)?.toLowerCase() ?? "";
  const symptoms = getDetectedSymptoms(context).join(" ").toLowerCase();
  const severity = stringValue(context.extracted?.severity)?.toLowerCase() ?? "";
  const guidance: string[] = [];

  guidance.push("Seek urgent in-person care if symptoms worsen significantly or new severe symptoms appear.");

  if (risk === "High" || risk === "Emergency" || /urgent|emergency|immediate|er/.test(triage) || /severe|worst|extreme/.test(severity)) {
    guidance.push("Seek urgent care immediately if symptoms are progressing quickly, or if daily functioning is impaired.");
  }

  if (/chest pain|breath|shortness of breath|confusion|faint|weakness|numb|speech|vision|neurologic|headache/.test(symptoms) || risk === "Emergency") {
    guidance.push("Go to the ER now for severe chest pain, fainting, severe breathing trouble, confusion, or severe neurological symptoms.");
  }

  return [...new Set(guidance)];
}

function buildDoctorVisitPrep(context: ParsedReportContext) {
  const symptoms = getDetectedSymptoms(context);
  const duration = stringValue(context.extracted?.duration);
  const severity = stringValue(context.extracted?.severity);
  const bodyArea = stringValue(context.extracted?.location_body_area);
  const followUpHighlights = context.followUps
    .filter((row) => row.answer.trim().length > 0)
    .slice(0, 3)
    .map((row) => `${row.question}: ${row.answer}`);

  const prep: string[] = [];
  prep.push(`Main symptoms: ${symptoms.length ? symptoms.join(", ") : "Not clearly captured"}`);
  if (duration) prep.push(`Duration timeline: ${duration}`);
  if (severity) prep.push(`Perceived severity: ${severity}`);
  if (bodyArea) prep.push(`Primary body area: ${bodyArea}`);
  prep.push(...followUpHighlights);
  return prep.slice(0, 6);
}

function deriveSymptomNextSteps(context: ParsedReportContext): string[] {
  const riskLevel = getRiskLevel(context)?.toLowerCase() ?? "";
  const triage = stringValue(context.outputs?.triage_recommendation);
  const followups = asStringArray(context.structuredData?.follow_up_questions);
  const symptomsLower = getDetectedSymptoms(context).join(" ").toLowerCase();
  const steps: string[] = [];

  steps.push("Monitor symptoms over the next 24 hours and keep notes on change patterns.");
  steps.push("Arrange outpatient follow-up to review this report with a clinician.");
  if (triage) steps.push(triage);

  if (riskLevel.includes("high") || /urgent|emergency/.test((triage ?? "").toLowerCase())) {
    steps.push("Seek urgent care right away if symptoms are worsening or new red-flag symptoms appear.");
  }

  if (/emergency/.test(riskLevel) || /chest pain|trouble breathing|confusion/.test(symptomsLower)) {
    steps.push("Go to the ER immediately for severe chest pain, confusion, or trouble breathing.");
  } else if (riskLevel.includes("moderate")) {
    steps.push("Escalate to urgent care if symptoms persist beyond 24 hours.");
  } else {
    steps.push("Continue routine self-monitoring and document duration/severity trends.");
  }

  if (followups.length > 0) {
    steps.push("Prepare answers to follow-up questions before your next care touchpoint.");
  }

  return [...new Set(steps)].slice(0, 5);
}

function buildCopySummary(report: ReportRead, context: ParsedReportContext, reportTitle: string) {
  const savedAt = formatDate(stringValue(context.parsedInput?.completed_at) ?? report.created_at) ?? "Unknown";
  const savedRelative = formatRelativeDate(stringValue(context.parsedInput?.completed_at) ?? report.created_at) ?? "Recently";

  if (report.report_type === "symptom-intake-guided") {
    const risk = getRiskLabel(getRiskLevel(context));
    const urgency = getUrgencyScore(report, context);
    const symptoms = getDetectedSymptoms(context);
    const triage = stringValue(context.outputs?.triage_recommendation) ?? "Not specified";
    const categories = asStringArray(context.structuredData?.categories);
    const immediateCare = deriveImmediateCareGuidance(context);
    const visitPrep = buildDoctorVisitPrep(context);
    const confidence = getConfidenceLabel(context);

    return [
      "HealthSignal AI Clinical Summary",
      `Title: ${reportTitle}`,
      `Saved: ${savedAt} (${savedRelative})`,
      `Risk: ${risk}`,
      `Urgency Score: ${urgency ? `${urgency.score} / 100` : "Not specified"}`,
      `Confidence: ${confidence}`,
      "",
      "Symptoms:",
      ...(symptoms.length ? symptoms.map((item) => `- ${item}`) : ["- Not specified"]),
      "",
      "Likely Categories:",
      ...(categories.length ? categories.map((item) => `- ${item}`) : ["- Not specified"]),
      "",
      "Recommendation:",
      triage,
      "",
      "Seek immediate care if:",
      ...immediateCare.map((item) => `- ${item}`),
      "",
      "Doctor visit prep:",
      ...visitPrep.map((item) => `- ${item}`)
    ].join("\n");
  }

  if (report.report_type === "note-interpreter-text" || report.report_type === "note-interpreter-file") {
    const summary = stringValue(context.interpretation?.plain_english_summary) ?? "Not specified";
    const meds = (Array.isArray(context.interpretation?.medicines_treatments) ? context.interpretation?.medicines_treatments : []) as Array<Record<string, unknown>>;
    const medNames = meds.map((entry) => stringValue(entry.item)).filter((item): item is string => Boolean(item));
    const nextSteps = asStringArray(context.interpretation?.next_steps);

    return [
      "HealthSignal AI Note Summary",
      `Title: ${reportTitle}`,
      `Saved: ${savedAt} (${savedRelative})`,
      "",
      "Plain-English Summary:",
      summary,
      "",
      "Medicines / Treatments:",
      ...(medNames.length ? medNames.map((item) => `- ${item}`) : ["- Not specified"]),
      "",
      "Suggested Next Steps:",
      ...(nextSteps.length ? nextSteps.map((item) => `- ${item}`) : ["- Not specified"])
    ].join("\n");
  }

  return `HealthSignal AI Saved Report\nTitle: ${reportTitle}\nSaved: ${savedAt} (${savedRelative})`;
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

function SectionCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="animate-fade-up space-y-3 rounded-2xl border border-slate-200/80 bg-white/85 p-4 transition duration-300 dark:border-slate-700/80 dark:bg-slate-900/65">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {icon}
        {title}
      </h3>
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
  const selectedUrgency = selectedReport && selectedContext ? getUrgencyScore(selectedReport, selectedContext) : null;
  const selectedConfidence = selectedContext ? getConfidenceLabel(selectedContext) : null;
  const selectedImmediateCare = selectedContext ? deriveImmediateCareGuidance(selectedContext) : [];
  const selectedVisitPrep = selectedContext ? buildDoctorVisitPrep(selectedContext) : [];

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

  async function shareWithDoctor() {
    if (!selectedReport || !selectedContext || !selectedTitle) return;
    const doctorFriendly = buildCopySummary(selectedReport, selectedContext, selectedTitle);

    try {
      await navigator.clipboard.writeText(doctorFriendly);
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
              <span aria-hidden>📄</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">No saved reports yet.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Completed analyses will appear here with report type and timestamp for longitudinal review.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/symptom-analyzer"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-700/25 transition hover:-translate-y-0.5 hover:bg-brand-600"
              >
                Start Symptom Check
              </Link>
              <Link
                href="/note-interpreter"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-brand-400/40"
              >
                Open Note Interpreter
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
                const reportCompletedAt = stringValue(context.parsedInput?.completed_at) ?? report.created_at;
                const reportTime = formatDate(reportCompletedAt) ?? "Unknown";
                const reportRelativeTime = formatRelativeDate(reportCompletedAt);

                return (
                  <li
                    key={report.id}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className={`premium-card premium-card-interactive animate-fade-up p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-900/10 ${
                      isActive ? "border-brand-300 ring-2 ring-brand-100 hover:border-brand-300 dark:border-brand-400/70 dark:ring-brand-500/20" : "border-slate-200/90"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                          <span aria-hidden>{report.report_type === "note-interpreter-file" ? "📥" : "📄"}</span>
                          {title}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{summary}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {formatReportType(report.report_type)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{reportRelativeTime ? `${reportRelativeTime} • ${reportTime}` : reportTime}</span>
                          <RiskBadge risk={risk} />
                          <UrgencyChip report={report} context={context} mini />
                        </div>
                        {report.report_type === "symptom-intake-guided" ? <UrgencyMeter report={report} context={context} compact /> : null}
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
                  <RiskBadge risk={selectedRisk} />
                  {selectedUrgency ? <UrgencyChip report={selectedReport} context={selectedContext} /> : null}
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{selectedHeaderSummary}</p>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3 text-xs text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
                <span>
                  Completed: {formatRelativeDate(stringValue(selectedContext.parsedInput?.completed_at) ?? selectedReport.created_at) ?? "Recently"} •{" "}
                  {formatDate(stringValue(selectedContext.parsedInput?.completed_at) ?? selectedReport.created_at) ?? "Unknown"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-brand-300/70 bg-white/90 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 dark:border-brand-400/50 dark:bg-slate-900/70 dark:text-brand-200 dark:hover:border-brand-300"
                    onClick={copySummary}
                  >
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden>📋</span>Copy Summary</span>
                  </button>
                  <button
                    className="cursor-not-allowed rounded-lg border border-slate-300/80 bg-slate-100/90 px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400"
                    disabled
                    title="PDF export is coming soon"
                  >
                    Download PDF
                  </button>
                  <button
                    className="rounded-lg border border-violet-300/70 bg-violet-50/80 px-3 py-1.5 text-xs font-medium text-violet-800 transition hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-100 dark:border-violet-400/45 dark:bg-violet-900/30 dark:text-violet-100 dark:hover:border-violet-300"
                    onClick={shareWithDoctor}
                  >
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden>💬</span>Share with Doctor</span>
                  </button>
                </div>
              </div>
              {copyStatus === "success" ? <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">Summary copied to clipboard.</p> : null}
              {copyStatus === "error" ? <p className="text-xs font-medium text-rose-600 dark:text-rose-300">Unable to copy summary right now.</p> : null}
            </header>

            {isSymptomGuided ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <SectionCard title="Risk & Triage" icon={<span aria-hidden>🩺</span>}>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <ReportDataRow label="Risk level" value={selectedRisk} />
                      <ReportDataRow label="Urgency score" value={selectedUrgency ? `${selectedUrgency.score} / 100` : null} />
                      <ReportDataRow label="Confidence" value={selectedConfidence} />
                    </div>
                    <UrgencyMeter report={selectedReport} context={selectedContext} />
                    <p className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                      {stringValue(selectedContext.outputs?.triage_recommendation) ?? "Not available."}
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Recommended Next Steps" icon={<span aria-hidden>⚠️</span>}>
                  {symptomNextSteps.length ? (
                    <ul className="space-y-2">
                      {symptomNextSteps.map((step) => {
                        const icon = /er|911|severe|trouble breathing|chest pain|confusion/i.test(step) ? "🚑" : /follow-up|arrange|appointment|outpatient/i.test(step) ? "📅" : "🕒";
                        return (
                          <li key={step} className="flex items-start gap-2 rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                            <span aria-hidden>{icon}</span>
                            <span>{step}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No next-step guidance saved for this report.</p>
                  )}
                </SectionCard>

                <SectionCard title="Original Symptom Input" icon={<span aria-hidden>📄</span>}>
                  <p className="rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(selectedContext.parsedInput?.original_input_text) ?? "Not available."}
                  </p>
                </SectionCard>

                <SectionCard title="Summary" icon={<span aria-hidden>📌</span>}>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{selectedHeaderSummary}</p>
                </SectionCard>

                <SectionCard title="Symptoms" icon={<span aria-hidden>🧠</span>}>
                  <ReportChipList items={getDetectedSymptoms(selectedContext)} />
                </SectionCard>

                <SectionCard title="Duration / Severity / Body Area" icon={<span aria-hidden>⏱</span>}>
                  <div className="grid gap-2 md:grid-cols-3">
                    <ReportDataRow label="Duration" value={stringValue(selectedContext.extracted?.duration)} />
                    <ReportDataRow label="Severity" value={stringValue(selectedContext.extracted?.severity)} />
                    <ReportDataRow label="Body area" value={stringValue(selectedContext.extracted?.location_body_area)} />
                  </div>
                </SectionCard>

                <SectionCard title="Likely Categories" icon={<span aria-hidden>📍</span>}>
                  <ReportChipList items={asStringArray(selectedContext.structuredData?.categories)} />
                </SectionCard>

                <SectionCard title="Follow-up Q&A" icon={<span aria-hidden>💬</span>}>
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

                <SectionCard title="When to Seek Immediate Care" icon={<span aria-hidden>🚨</span>}>
                  <div className="space-y-2 rounded-xl border border-rose-200/80 bg-rose-50/85 p-3 dark:border-rose-500/35 dark:bg-rose-950/30">
                    <ul className="space-y-2">
                      {selectedImmediateCare.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-rose-800 dark:text-rose-100">
                          <span aria-hidden>⚠️</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </SectionCard>

                <SectionCard title="Doctor Visit Prep" icon={<span aria-hidden>🗂️</span>}>
                  <ul className="space-y-2">
                    {selectedVisitPrep.map((item) => (
                      <li key={item} className="rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                        {item}
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard title="Saved Timestamp / Metadata" icon={<span aria-hidden>📅</span>}>
                  <div className="grid gap-2 md:grid-cols-2">
                    <ReportDataRow label="Saved timestamp" value={formatDate(stringValue(selectedContext.parsedInput?.completed_at) ?? selectedReport.created_at)} />
                    <ReportDataRow label="Report type" value={formatReportType(selectedReport.report_type)} />
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {isNoteInterpreter ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <SectionCard title="Original Note Input" icon={<span aria-hidden>📄</span>}>
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {stringValue(selectedContext.parsedInput?.original_input_text) ?? "Not available."}
                  </p>
                </SectionCard>

                <SectionCard title="Summary" icon={<span aria-hidden>📌</span>}>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{stringValue(selectedContext.interpretation?.plain_english_summary) ?? "Not available."}</p>
                </SectionCard>

                <SectionCard title="Medicines / Treatments Mentioned" icon={<span aria-hidden>🩺</span>}>
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

                <SectionCard title="Medical Terms Explained" icon={<span aria-hidden>📍</span>}>
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

                <SectionCard title="Suggested Next Steps" icon={<span aria-hidden>⚠️</span>}>
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

                <SectionCard title="Follow-up Q&A" icon={<span aria-hidden>💬</span>}>
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

                <SectionCard title="Saved Timestamp / Metadata" icon={<span aria-hidden>📅</span>}>
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
