"use client";

import { FormEvent, useMemo, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { RequireAuth } from "@/components/RequireAuth";
import { analyzeSymptoms, getUserErrorMessage } from "@/lib/api";
import { AnalysisResponse } from "@/lib/types";

const COMMON_SYMPTOMS = [
  "headache",
  "fever",
  "cough",
  "fatigue",
  "dizziness",
  "nausea",
  "chest pain",
  "shortness of breath",
  "sore throat",
  "stomach pain"
] as const;

const DURATION_OPTIONS = ["Less than 24 hours", "1-3 days", "4-7 days", "More than 1 week"] as const;
const SEVERITY_OPTIONS = ["Mild", "Moderate", "Severe"] as const;

function addSymptomText(currentValue: string, symptom: string) {
  const normalized = currentValue.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes(symptom.toLowerCase())) {
    return currentValue;
  }

  if (!normalized) {
    return symptom;
  }

  const endsWithPunctuation = /[.!?]$/.test(normalized);
  const separator = endsWithPunctuation ? " " : ", ";
  return `${normalized}${separator}${symptom}`;
}

export default function SymptomAnalyzerPage() {
  const [symptoms, setSymptoms] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const structuredDetails = useMemo(() => {
    const parts = [
      duration ? `Duration: ${duration}` : null,
      severity ? `Severity: ${severity}` : null
    ].filter(Boolean);

    return parts.length > 0 ? ` (${parts.join(" | ")})` : "";
  }, [duration, severity]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = `${symptoms.trim()}${structuredDetails}`;

    try {
      const response = await analyzeSymptoms({ symptoms: payload });
      setResult(response);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to analyze symptoms right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Symptom Analyzer</h1>
        <DisclaimerBanner />

        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Guided symptom intake</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Share what you feel, where it hurts, when it started, and what makes it better or worse. Include duration and severity if known.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">1) Describe your symptoms</legend>
            <textarea
              className="min-h-40 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400"
              placeholder="Example: I've had chest tightness, shortness of breath, and dizziness for two days..."
              value={symptoms}
              onChange={(event) => setSymptoms(event.target.value)}
              required
              minLength={3}
            />

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Common symptoms</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_SYMPTOMS.map((symptom) => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => setSymptoms((current) => addSymptomText(current, symptom))}
                    className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700/80"
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">2) Optional details</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Duration</span>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                >
                  <option value="">Select duration (optional)</option>
                  {DURATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Severity</span>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                >
                  <option value="">Select severity (optional)</option>
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Symptoms"}
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-slate-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400"
              aria-disabled="true"
            >
              Voice input coming soon
            </button>
          </div>
        </form>

        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {result ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Review the findings below and seek urgent care for severe or worsening symptoms.</p>
            <AnalysisResultCard result={result} />
          </div>
        ) : null}
      </section>
    </RequireAuth>
  );
}
