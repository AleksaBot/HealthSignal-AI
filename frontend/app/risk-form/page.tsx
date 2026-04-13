"use client";

import { FormEvent, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { RequireAuth } from "@/components/RequireAuth";
import { analyzeRisk, getUserErrorMessage } from "@/lib/api";
import { AnalysisResponse } from "@/lib/types";

type LifestyleChoice = "none" | "occasional" | "often";
type ActivityChoice = "low" | "moderate" | "active";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function RiskFormPage() {
  const [advancedEnabled, setAdvancedEnabled] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    const age = Number(formData.get("age"));
    const heightCm = Number(formData.get("height_cm"));
    const weightKg = Number(formData.get("weight_kg"));
    const smoking = formData.get("smoking") === "yes";

    if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) {
      setError("Please enter valid height and weight.");
      setLoading(false);
      return;
    }
    const alcohol = (formData.get("alcohol") as LifestyleChoice) ?? "none";
    const activity = (formData.get("activity_level") as ActivityChoice) ?? "moderate";

    const symptomCount = ["fatigue", "shortness_breath", "chest_discomfort", "dizziness"].filter((key) => formData.has(key)).length;

    const bmi = weightKg / ((heightCm / 100) ** 2);
    const bmiDelta = bmi - 22;

    const lifestyleBpLift =
      (smoking ? 8 : 0) +
      (alcohol === "often" ? 4 : alcohol === "occasional" ? 2 : 0) +
      (activity === "low" ? 5 : activity === "active" ? -4 : 0);

    const estimatedSystolic = Math.round(112 + (age - 40) * 0.5 + bmiDelta * 1.1 + lifestyleBpLift + symptomCount * 2);
    const estimatedDiastolic = Math.round(72 + (age - 40) * 0.25 + bmiDelta * 0.6 + lifestyleBpLift * 0.35 + symptomCount);
    const estimatedGlucose = Math.round(
      88 + bmiDelta * 1.4 + (activity === "low" ? 8 : activity === "active" ? -5 : 0) + (alcohol === "often" ? 6 : 0) + (smoking ? 4 : 0)
    );
    const estimatedHba1c = Number((5.1 + (estimatedGlucose - 90) / 35 + (symptomCount >= 2 ? 0.2 : 0)).toFixed(1));
    const estimatedLdl = Math.round(95 + bmiDelta * 1.2 + (smoking ? 12 : 0) + (activity === "active" ? -10 : activity === "low" ? 8 : 0));

    try {
      const response = await analyzeRisk({
        age: clamp(Math.round(age), 0, 120),
        systolic_bp: clamp(Math.round(toOptionalNumber(formData.get("systolic_bp")) ?? estimatedSystolic), 70, 260),
        diastolic_bp: clamp(Math.round(toOptionalNumber(formData.get("diastolic_bp")) ?? estimatedDiastolic), 40, 160),
        fasting_glucose: clamp(toOptionalNumber(formData.get("fasting_glucose")) ?? estimatedGlucose, 40, 600),
        hba1c: clamp(toOptionalNumber(formData.get("hba1c")) ?? estimatedHba1c, 3, 20),
        ldl_cholesterol: clamp(toOptionalNumber(formData.get("ldl_cholesterol")) ?? estimatedLdl, 20, 400)
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
        <h1 className="text-2xl font-bold">Health Profile + Risk Screener</h1>
        <DisclaimerBanner />
        <p className="text-sm text-slate-600 dark:text-slate-300">Complete this quick assessment for educational risk insights. You can add lab values in Advanced mode if you have them.</p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">1) Basic Info</legend>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Age</span>
                <input className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400" name="age" type="number" min={0} max={120} placeholder="e.g. 42" required />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Height (cm)</span>
                <input className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400" name="height_cm" type="number" min={100} max={230} placeholder="e.g. 170" required />
                <span className="text-xs text-slate-500 dark:text-slate-400">Use centimeters, e.g. 170</span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Weight (kg)</span>
                <input className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400" name="weight_kg" type="number" min={30} max={300} placeholder="e.g. 72" required />
                <span className="text-xs text-slate-500 dark:text-slate-400">Use kilograms, e.g. 70</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">2) Lifestyle</legend>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Smoking</span>
                <select className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400" name="smoking" defaultValue="no">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Alcohol</span>
                <select className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400" name="alcohol" defaultValue="none">
                  <option value="none">None</option>
                  <option value="occasional">Occasionally</option>
                  <option value="often">Often</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">Activity level</span>
                <select className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400" name="activity_level" defaultValue="moderate">
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="active">Active</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">3) Simple Symptoms</legend>
            <p className="text-xs text-slate-500 dark:text-slate-400">Check any symptoms you are currently noticing.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <input name="fatigue" type="checkbox" className="h-4 w-4 rounded border-slate-400 text-brand-700 focus:ring-brand-500 dark:border-slate-500 dark:bg-slate-900 dark:text-brand-400 dark:focus:ring-brand-400" />
                Fatigue
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <input name="shortness_breath" type="checkbox" className="h-4 w-4 rounded border-slate-400 text-brand-700 focus:ring-brand-500 dark:border-slate-500 dark:bg-slate-900 dark:text-brand-400 dark:focus:ring-brand-400" />
                Shortness of breath (trouble breathing)
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <input name="chest_discomfort" type="checkbox" className="h-4 w-4 rounded border-slate-400 text-brand-700 focus:ring-brand-500 dark:border-slate-500 dark:bg-slate-900 dark:text-brand-400 dark:focus:ring-brand-400" />
                Chest discomfort
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <input name="dizziness" type="checkbox" className="h-4 w-4 rounded border-slate-400 text-brand-700 focus:ring-brand-500 dark:border-slate-500 dark:bg-slate-900 dark:text-brand-400 dark:focus:ring-brand-400" />
                Dizziness
              </label>
            </div>
          </fieldset>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800 dark:text-slate-200">
              <span>Advanced (optional)</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-400 text-brand-700 focus:ring-brand-500 dark:border-slate-500 dark:bg-slate-900 dark:text-brand-400 dark:focus:ring-brand-400"
                checked={advancedEnabled}
                onChange={(event) => setAdvancedEnabled(event.target.checked)}
              />
            </label>
            {advancedEnabled ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400" name="systolic_bp" placeholder="Systolic BP" type="number" min={70} max={260} />
                <input className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400" name="diastolic_bp" placeholder="Diastolic BP" type="number" min={40} max={160} />
                <input className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400" name="fasting_glucose" placeholder="Fasting glucose" type="number" min={40} max={600} />
                <input className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400" name="hba1c" placeholder="HbA1c (%)" type="number" min={3} max={20} step="0.1" />
                <input className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400 md:col-span-2" name="ldl_cholesterol" placeholder="LDL cholesterol" type="number" min={20} max={400} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Leave this off for a quick estimate. Turn it on if you have clinical readings.</p>
            )}
          </div>

          <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" disabled={loading}>
            {loading ? "Calculating..." : "Check My Health Risk"}
          </button>
        </form>

        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {result ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">These insights are based on general health patterns and are not a medical diagnosis.</p>
            <AnalysisResultCard result={result} />
          </div>
        ) : null}
      </section>
    </RequireAuth>
  );
}
