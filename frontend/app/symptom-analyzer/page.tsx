"use client";

import { FormEvent, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { RequireAuth } from "@/components/RequireAuth";
import { analyzeSymptoms, getUserErrorMessage } from "@/lib/api";
import { AnalysisResponse } from "@/lib/types";

export default function SymptomAnalyzerPage() {
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await analyzeSymptoms({ symptoms });
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
        <p className="text-sm text-slate-600">Describe symptoms in plain English for structured extraction and risk cues.</p>
        <form className="space-y-3" onSubmit={onSubmit}>
          <textarea
            className="min-h-40 w-full rounded-xl border border-slate-300 bg-white p-3"
            placeholder="Example: I've had chest tightness, shortness of breath, and dizziness for two days..."
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            required
            minLength={3}
          />
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" disabled={loading}>
            {loading ? "Analyzing..." : "Analyze Symptoms"}
          </button>
        </form>
        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {result ? <AnalysisResultCard result={result} /> : null}
      </section>
    </RequireAuth>
  );
}
