"use client";

import { FormEvent, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { RequireAuth } from "@/components/RequireAuth";
import { analyzeRisk, getUserErrorMessage } from "@/lib/api";
import { AnalysisResponse } from "@/lib/types";

export default function RiskFormPage() {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await analyzeRisk({
        age: Number(formData.get("age")),
        systolic_bp: Number(formData.get("systolic_bp")),
        diastolic_bp: Number(formData.get("diastolic_bp")),
        fasting_glucose: Number(formData.get("fasting_glucose")),
        hba1c: Number(formData.get("hba1c")),
        ldl_cholesterol: Number(formData.get("ldl_cholesterol"))
      });
      setResult(response);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to calculate risk insights right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Risk Form</h1>
        <DisclaimerBanner />
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-lg border p-2" name="age" placeholder="Age" type="number" min={0} max={120} required />
            <input className="rounded-lg border p-2" name="systolic_bp" placeholder="Systolic BP" type="number" min={70} max={260} required />
            <input className="rounded-lg border p-2" name="diastolic_bp" placeholder="Diastolic BP" type="number" min={40} max={160} required />
            <input className="rounded-lg border p-2" name="fasting_glucose" placeholder="Fasting glucose" type="number" min={40} max={600} required />
            <input className="rounded-lg border p-2" name="hba1c" placeholder="HbA1c (%)" type="number" min={3} max={20} step="0.1" required />
            <input className="rounded-lg border p-2" name="ldl_cholesterol" placeholder="LDL cholesterol" type="number" min={20} max={400} required />
          </div>
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" disabled={loading}>
            {loading ? "Calculating..." : "Calculate Risk Insights"}
          </button>
        </form>
        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {result ? <AnalysisResultCard result={result} /> : null}
      </section>
    </RequireAuth>
  );
}
