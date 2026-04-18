"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { generateHealthInsights, getHealthProfile, getUserErrorMessage, saveReport, upsertHealthProfile } from "@/lib/api";
import { HealthProfile, HealthRiskInsightsResponse } from "@/lib/types";

const EMPTY_PROFILE: HealthProfile = {
  age: null,
  sex: null,
  height_cm: null,
  weight_kg: null,
  activity_level: null,
  smoking_vaping_status: null,
  alcohol_frequency: null,
  sleep_average_hours: null,
  stress_level: null,
  known_conditions: [],
  current_medications: [],
  family_history: [],
  systolic_bp: null,
  diastolic_bp: null,
  total_cholesterol: null,
  updated_at: null
};

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: string[]) {
  return value.join(", ");
}

function profileCompletion(profile: HealthProfile) {
  const checks = [
    profile.age,
    profile.sex,
    profile.height_cm,
    profile.weight_kg,
    profile.activity_level,
    profile.smoking_vaping_status,
    profile.alcohol_frequency,
    profile.sleep_average_hours,
    profile.stress_level
  ];

  const complete = checks.filter((item) => item !== null && item !== undefined).length;
  return Math.round((complete / checks.length) * 100);
}

function levelClasses(level: "positive" | "watch" | "caution") {
  if (level === "positive") return "border-emerald-300/70 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200";
  if (level === "watch") return "border-amber-300/80 bg-amber-50/80 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200";
  return "border-rose-300/80 bg-rose-50/80 text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200";
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<HealthProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<HealthRiskInsightsResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReportId, setSavedReportId] = useState<number | null>(null);

  const completion = useMemo(() => profileCompletion(profile), [profile]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await getHealthProfile();
        setProfile({ ...EMPTY_PROFILE, ...response });
      } catch (err) {
        setError(getUserErrorMessage(err, "Unable to load your health profile."));
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function updateField<K extends keyof HealthProfile>(key: K, value: HealthProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaveMessage(null);
    setSavedReportId(null);
  }

  async function onSaveProfile() {
    setSaving(true);
    setError(null);

    try {
      const response = await upsertHealthProfile(profile);
      setProfile(response);
      setSaveMessage("Health profile updated.");
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to save health profile."));
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateInsights() {
    setGenerating(true);
    setError(null);

    try {
      const response = await generateHealthInsights();
      setInsights(response);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to generate insights yet. Make sure age, height, and weight are saved."));
    } finally {
      setGenerating(false);
    }
  }

  async function onSaveReport() {
    if (!insights || savingReport || savedReportId) return;

    setSavingReport(true);
    setError(null);

    try {
      const response = await saveReport({
        report_type: "health-profile-risk-insights-v1",
        original_input_text: "Health Profile + Risk Insights educational report",
        structured_data: {
          profile_snapshot: insights.profile_snapshot
        },
        follow_up_qa: [],
        outputs: {
          overall_health_snapshot: insights.overall_health_snapshot,
          cardiovascular_caution: insights.cardiovascular_caution,
          metabolic_weight_caution: insights.metabolic_weight_caution,
          lifestyle_risk_factors: insights.lifestyle_risk_factors,
          positive_habits: insights.positive_habits,
          top_priorities_for_improvement: insights.top_priorities_for_improvement,
          suggested_next_steps: insights.suggested_next_steps,
          generated_at: insights.generated_at,
          disclaimer: insights.disclaimer
        },
        source_metadata: {
          workflow: "health-profile-risk-insights-v1"
        },
        completed_at: insights.generated_at
      });

      setSavedReportId(response.id);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to save report right now."));
    } finally {
      setSavingReport(false);
    }
  }

  if (loading) {
    return (
      <RequireAuth>
        <section className="section-shell p-8">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading your profile...</p>
        </section>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <section className="section-shell space-y-6 p-6 md:p-8">
        <div className="ambient-orb -right-16 -top-12 h-40 w-40 bg-brand-300/25" />
        <div className="ambient-orb -bottom-20 left-0 h-56 w-56 bg-cyan-200/20" />

        <div className="relative space-y-3 border-b border-slate-200/80 pb-5 dark:border-slate-700/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Health Profile</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Personal baseline + risk insights</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">Keep a simple health baseline, then generate practical educational insights. No diagnosis, no complex clinical calculator feel.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="premium-card p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Profile completion</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{completion}%</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Complete key basics for better quality insights.</p>
          </article>

          <article className="premium-card p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Last updated</p>
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{profile.updated_at ? new Date(profile.updated_at).toLocaleString() : "Not saved yet"}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Saved to your account and reused in risk insights.</p>
          </article>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="premium-card space-y-4 p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Core profile</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Age</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.age ?? ""} onChange={(event) => updateField("age", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Sex</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.sex ?? ""} onChange={(event) => updateField("sex", (event.target.value || null) as HealthProfile["sex"])}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
              <label className="space-y-1 text-sm"><span>Height (cm)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.height_cm ?? ""} onChange={(event) => updateField("height_cm", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Weight (kg)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.weight_kg ?? ""} onChange={(event) => updateField("weight_kg", event.target.value ? Number(event.target.value) : null)} /></label>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">These are your baseline anchors for educational trend insights.</p>
          </article>

          <article className="premium-card space-y-4 p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Lifestyle snapshot</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Activity level</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.activity_level ?? ""} onChange={(event) => updateField("activity_level", (event.target.value || null) as HealthProfile["activity_level"])}><option value="">Select</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very active</option></select></label>
              <label className="space-y-1 text-sm"><span>Smoking / vaping</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.smoking_vaping_status ?? ""} onChange={(event) => updateField("smoking_vaping_status", (event.target.value || null) as HealthProfile["smoking_vaping_status"])}><option value="">Select</option><option value="none">None</option><option value="former">Former</option><option value="occasional">Occasional</option><option value="daily">Daily</option></select></label>
              <label className="space-y-1 text-sm"><span>Alcohol frequency</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.alcohol_frequency ?? ""} onChange={(event) => updateField("alcohol_frequency", (event.target.value || null) as HealthProfile["alcohol_frequency"])}><option value="">Select</option><option value="never">Never</option><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="several_times_weekly">Several times weekly</option><option value="daily">Daily</option></select></label>
              <label className="space-y-1 text-sm"><span>Sleep average (hours)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" step="0.5" value={profile.sleep_average_hours ?? ""} onChange={(event) => updateField("sleep_average_hours", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm sm:col-span-2"><span>Stress level</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.stress_level ?? ""} onChange={(event) => updateField("stress_level", (event.target.value || null) as HealthProfile["stress_level"])}><option value="">Select</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="very_high">Very high</option></select></label>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Short and practical habits drive most of your suggestions.</p>
          </article>

          <article className="premium-card space-y-4 p-5 md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">History + optional metrics</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Known conditions</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. hypertension, asthma" value={joinList(profile.known_conditions)} onChange={(event) => updateField("known_conditions", parseList(event.target.value))} /></label>
              <label className="space-y-1 text-sm"><span>Current medications</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. lisinopril" value={joinList(profile.current_medications)} onChange={(event) => updateField("current_medications", parseList(event.target.value))} /></label>
              <label className="space-y-1 text-sm md:col-span-2"><span>Family history</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. heart disease, type 2 diabetes" value={joinList(profile.family_history)} onChange={(event) => updateField("family_history", parseList(event.target.value))} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm"><span>Systolic BP (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.systolic_bp ?? ""} onChange={(event) => updateField("systolic_bp", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Diastolic BP (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.diastolic_bp ?? ""} onChange={(event) => updateField("diastolic_bp", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Total cholesterol (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.total_cholesterol ?? ""} onChange={(event) => updateField("total_cholesterol", event.target.value ? Number(event.target.value) : null)} /></label>
            </div>
          </article>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={onSaveProfile} disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" onClick={onGenerateInsights} disabled={generating}>{generating ? "Generating..." : "Generate Risk Insights"}</button>
          {savedReportId ? (
            <Link href="/history" className="rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-200">View Saved Reports</Link>
          ) : null}
        </div>

        {saveMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">{saveMessage}</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        {insights ? (
          <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Risk Insights</p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Overall Health Snapshot</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{insights.overall_health_snapshot}</p>
              </div>
              <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={onSaveReport} disabled={savingReport || savedReportId !== null}>{savedReportId ? "Report Saved" : savingReport ? "Saving Report..." : "Save as Report"}</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className={`rounded-xl border p-4 ${levelClasses(insights.cardiovascular_caution.level)}`}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Cardiovascular Caution</h3>
                <p className="mt-2 text-sm">{insights.cardiovascular_caution.summary}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {insights.cardiovascular_caution.factors.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
              <article className={`rounded-xl border p-4 ${levelClasses(insights.metabolic_weight_caution.level)}`}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Metabolic / Weight-related Caution</h3>
                <p className="mt-2 text-sm">{insights.metabolic_weight_caution.summary}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {insights.metabolic_weight_caution.factors.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="premium-card p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Lifestyle Risk Factors</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{insights.lifestyle_risk_factors.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
              <article className="premium-card p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Positive Habits</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{insights.positive_habits.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
              <article className="premium-card p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Top Priorities for Improvement</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{insights.top_priorities_for_improvement.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
              <article className="premium-card p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Suggested Next Steps</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{insights.suggested_next_steps.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">{insights.disclaimer}</p>
          </section>
        ) : null}
      </section>
    </RequireAuth>
  );
}
