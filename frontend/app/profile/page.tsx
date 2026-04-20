"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { generateHealthInsights, getHealthProfile, getUserErrorMessage, saveReport, updateTodayMedicationStatus, upsertHealthProfile } from "@/lib/api";
import { HealthProfile, HealthRiskInsightsResponse, MedicationAdherenceStatus, MedicationEntry, MedicationFrequency, MedicationTimeOfDay } from "@/lib/types";

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
  medications: [],
  family_history: [],
  systolic_bp: null,
  diastolic_bp: null,
  total_cholesterol: null,
  medication_reminders_enabled: false,
  medication_reminder_time: "08:00",
  weekly_health_summary_enabled: false,
  updated_at: null
};

type MedicationDraft = {
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  custom_frequency: string;
  time_of_day: MedicationTimeOfDay | "";
  notes: string;
};

const EMPTY_MEDICATION_DRAFT: MedicationDraft = {
  name: "",
  dosage: "",
  frequency: "daily",
  custom_frequency: "",
  time_of_day: "",
  notes: ""
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

function normalizeMedicationNames(medications: MedicationEntry[]) {
  return medications.map((entry) => entry.name.trim()).filter(Boolean);
}

function generateMedicationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `med-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

function formatMedicationStatusLabel(status: MedicationAdherenceStatus | null | undefined) {
  if (status === "taken") return "Taken today";
  if (status === "skipped") return "Skipped today";
  return "Pending";
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [medicationDraft, setMedicationDraft] = useState<MedicationDraft>(EMPTY_MEDICATION_DRAFT);
  const [updatingMedicationId, setUpdatingMedicationId] = useState<string | null>(null);

  const completionPercent = useMemo(() => profileCompletion(profile), [profile]);
  const todaysStatusByMedicationId = useMemo(
    () => new Map((profile.todays_medication_status ?? []).map((entry) => [entry.medication_id, entry.status])),
    [profile.todays_medication_status]
  );
  const medicationsDueToday = useMemo(
    () => profile.medications.filter((medication) => medication.frequency !== "as_needed"),
    [profile.medications]
  );

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await getHealthProfile();
        const normalizedMedications = response.medications?.length
          ? response.medications
          : (response.current_medications ?? []).map((name) => ({
              id: generateMedicationId(),
              name,
              dosage: null,
              frequency: "daily" as const,
              custom_frequency: null,
              time_of_day: null,
              notes: "Imported from your previous My Health medications list."
            }));
        setProfile({
          ...EMPTY_PROFILE,
          ...response,
          medications: normalizedMedications,
          current_medications: normalizeMedicationNames(normalizedMedications)
        });
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

  function onAddMedication() {
    const name = medicationDraft.name.trim();
    if (!name) {
      setError("Medication name is required.");
      return;
    }

    const nextMedication: MedicationEntry = {
      id: generateMedicationId(),
      name,
      dosage: medicationDraft.dosage.trim() || null,
      frequency: medicationDraft.frequency,
      custom_frequency: medicationDraft.frequency === "custom" ? medicationDraft.custom_frequency.trim() || null : null,
      time_of_day: medicationDraft.time_of_day || null,
      notes: medicationDraft.notes.trim() || null
    };

    setProfile((current) => {
      const medications = [...current.medications, nextMedication];
      return {
        ...current,
        medications,
        current_medications: normalizeMedicationNames(medications)
      };
    });

    setMedicationDraft(EMPTY_MEDICATION_DRAFT);
    setError(null);
    setSaveMessage(null);
    setSavedReportId(null);
  }

  function onRemoveMedication(medicationId: string) {
    setProfile((current) => {
      const medications = current.medications.filter((entry) => entry.id !== medicationId);
      return {
        ...current,
        medications,
        current_medications: normalizeMedicationNames(medications)
      };
    });
    setSaveMessage(null);
    setSavedReportId(null);
  }

  async function onUpdateMedicationTodayStatus(medicationId: string, status: MedicationAdherenceStatus) {
    setUpdatingMedicationId(medicationId);
    setError(null);

    try {
      const response = await updateTodayMedicationStatus({ medication_id: medicationId, status });
      setProfile({
        ...response,
        medications: response.medications ?? [],
        current_medications: normalizeMedicationNames(response.medications ?? [])
      });
      setSaveMessage("Medication adherence saved for today.");
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to update medication status."));
    } finally {
      setUpdatingMedicationId(null);
    }
  }

  async function onSaveProfile() {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...profile,
        current_medications: normalizeMedicationNames(profile.medications)
      };
      const response = await upsertHealthProfile(payload);
      setProfile({
        ...response,
        medications: response.medications ?? [],
        current_medications: normalizeMedicationNames(response.medications ?? [])
      });
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

  async function onCopySummary() {
    if (!insights) return;
    const savedAt = insights.generated_at ? new Date(insights.generated_at).toLocaleString() : "Unknown";
    const summary = [
      "HealthSignal AI Profile Insight Summary",
      `Saved: ${savedAt}`,
      `Overall Snapshot: ${insights.overall_health_snapshot}`,
      `Cardiovascular Caution: ${insights.cardiovascular_caution.summary}`,
      `Metabolic / Weight-related Caution: ${insights.metabolic_weight_caution.summary}`,
      "",
      "Lifestyle Risk Factors:",
      ...(insights.lifestyle_risk_factors.length ? insights.lifestyle_risk_factors.map((item) => `- ${item}`) : ["- None noted"]),
      "",
      "Positive Habits:",
      ...(insights.positive_habits.length ? insights.positive_habits.map((item) => `- ${item}`) : ["- None noted"]),
      "",
      "Top Priorities:",
      ...(insights.top_priorities_for_improvement.length ? insights.top_priorities_for_improvement.map((item) => `- ${item}`) : ["- None noted"]),
      "",
      "Suggested Next Steps:",
      ...(insights.suggested_next_steps.length ? insights.suggested_next_steps.map((item) => `- ${item}`) : ["- None noted"])
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("success");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">My Health</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Health Profile, Live Risk Insights, and Medication Tracker</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Keep your baseline current, generate live insights from saved profile data, and maintain your active medications in one clean My Health workspace.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="premium-card p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Profile completion</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{completionPercent}%</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 ease-out"
                style={{ width: `${completionPercent}%` }}
              />
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">1. Health Profile baseline</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">1. Health Profile baseline</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">1. Health Profile baseline</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">History + optional metrics</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Known conditions</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. hypertension, asthma" value={joinList(profile.known_conditions)} onChange={(event) => updateField("known_conditions", parseList(event.target.value))} /></label>
              <div className="space-y-1 text-sm">
                <span>Current medications</span>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  Managed below in Medication Tracker ({profile.medications.length} active).
                </div>
              </div>
              <label className="space-y-1 text-sm md:col-span-2"><span>Family history</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. heart disease, type 2 diabetes" value={joinList(profile.family_history)} onChange={(event) => updateField("family_history", parseList(event.target.value))} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm"><span>Systolic BP (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.systolic_bp ?? ""} onChange={(event) => updateField("systolic_bp", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Diastolic BP (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.diastolic_bp ?? ""} onChange={(event) => updateField("diastolic_bp", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Total cholesterol (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.total_cholesterol ?? ""} onChange={(event) => updateField("total_cholesterol", event.target.value ? Number(event.target.value) : null)} /></label>
            </div>
          </article>
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">3. Medication Tracker</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Medication Tracker V2</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Use Today&apos;s Medications for quick adherence updates, manage your active list, and review recent taken/skipped history.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-cyan-200/70 bg-cyan-50/60 p-4 dark:border-cyan-900/70 dark:bg-cyan-950/20">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-200">Today&apos;s Medications</h3>
              <p className="mt-1 text-xs text-cyan-900/80 dark:text-cyan-200/80">Mark each scheduled medication as taken or skipped for {new Date().toLocaleDateString()}.</p>
              <div className="mt-3 space-y-2">
                {medicationsDueToday.length ? medicationsDueToday.map((medication) => (
                  <div key={`today-${medication.id}`} className="rounded-lg border border-cyan-200/80 bg-white/80 p-3 dark:border-cyan-900/70 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{medication.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{formatMedicationStatusLabel(todaysStatusByMedicationId.get(medication.id))}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                          onClick={() => onUpdateMedicationTodayStatus(medication.id, "taken")}
                          disabled={updatingMedicationId === medication.id}
                        >
                          Taken
                        </button>
                        <button
                          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-60 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                          onClick={() => onUpdateMedicationTodayStatus(medication.id, "skipped")}
                          disabled={updatingMedicationId === medication.id}
                        >
                          Skipped
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-lg border border-dashed border-cyan-300/80 bg-white/70 p-3 text-xs text-cyan-900/80 dark:border-cyan-900/60 dark:bg-slate-900/60 dark:text-cyan-200/80">No scheduled medications for today yet.</p>
                )}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/55">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Recent Adherence</h3>
              <div className="mt-3 space-y-2">
                {(profile.recent_medication_events ?? []).length ? profile.recent_medication_events?.map((event, index) => (
                  <div key={`${event.medication_id}-${event.event_date}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{event.medication_name}</span>
                    <span className="text-slate-500 dark:text-slate-400">{new Date(event.event_date).toLocaleDateString()} · {event.status}</span>
                  </div>
                )) : (
                  <p className="rounded-lg border border-dashed border-slate-300/80 bg-white/80 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">No adherence history yet. Mark taken/skipped in Today&apos;s Medications.</p>
                )}
              </div>
            </article>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Medication name</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. Metformin" value={medicationDraft.name} onChange={(event) => setMedicationDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-1 text-sm"><span>Dosage (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. 500mg" value={medicationDraft.dosage} onChange={(event) => setMedicationDraft((current) => ({ ...current, dosage: event.target.value }))} /></label>
            <label className="space-y-1 text-sm">
              <span>Frequency</span>
              <select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={medicationDraft.frequency} onChange={(event) => setMedicationDraft((current) => ({ ...current, frequency: event.target.value as MedicationFrequency }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="as_needed">As needed</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {medicationDraft.frequency === "custom" ? (
              <label className="space-y-1 text-sm"><span>Custom frequency</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. Every other day" value={medicationDraft.custom_frequency} onChange={(event) => setMedicationDraft((current) => ({ ...current, custom_frequency: event.target.value }))} /></label>
            ) : null}
            <label className="space-y-1 text-sm">
              <span>Time of day (optional)</span>
              <select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={medicationDraft.time_of_day} onChange={(event) => setMedicationDraft((current) => ({ ...current, time_of_day: event.target.value as MedicationTimeOfDay | "" }))}>
                <option value="">Not specified</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="bedtime">Bedtime</option>
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2"><span>Notes (optional)</span><textarea className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" rows={2} value={medicationDraft.notes} onChange={(event) => setMedicationDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
          </div>
          <div>
            <button className="rounded-lg border border-brand-300/80 bg-brand-50/90 px-4 py-2 text-sm font-medium text-brand-800 transition hover:-translate-y-0.5 hover:bg-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onClick={onAddMedication}>Add medication</button>
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Active Medications</h3>
          {profile.medications.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {profile.medications.map((medication) => (
                <article key={medication.id} className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/55">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{medication.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(medication.frequency === "custom" ? medication.custom_frequency : medication.frequency)?.replaceAll("_", " ") || "No frequency"}{medication.time_of_day ? ` • ${medication.time_of_day}` : ""}
                      </p>
                    </div>
                    <button className="text-xs font-medium text-rose-600 hover:text-rose-500" onClick={() => onRemoveMedication(medication.id)}>Remove</button>
                  </div>
                  {medication.dosage ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Dosage: {medication.dosage}</p> : null}
                  {medication.notes ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{medication.notes}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/45 dark:text-slate-300">No medications added yet. Add your first medication above.</p>
          )}
        </section>

        <section className="premium-card space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">4. Notifications foundation</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reminder preferences</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Set your reminder intent now. Scheduled delivery channels can be connected in a future release.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/70">
              <input
                type="checkbox"
                checked={profile.medication_reminders_enabled}
                onChange={(event) => updateField("medication_reminders_enabled", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-400"
              />
              <span>
                <span className="font-medium text-slate-900 dark:text-slate-100">Medication reminders</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Use your active Medication Tracker list as reminder context.</span>
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span>Preferred reminder time</span>
              <input
                type="time"
                value={profile.medication_reminder_time ?? "08:00"}
                onChange={(event) => updateField("medication_reminder_time", event.target.value || null)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white/80 p-3 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-900/70">
              <input
                type="checkbox"
                checked={profile.weekly_health_summary_enabled}
                onChange={(event) => updateField("weekly_health_summary_enabled", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-400"
              />
              <span>
                <span className="font-medium text-slate-900 dark:text-slate-100">Weekly health summary</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Receive a weekly educational recap of trends, adherence, and next-step suggestions.</span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={onSaveProfile} disabled={saving}>{saving ? "Saving..." : "Save My Health"}</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500" onClick={onGenerateInsights} disabled={generating}>{generating ? "Refreshing..." : "Refresh Insights"}</button>
          <Link href="/history" className="rounded-lg border border-brand-300/80 bg-brand-50/90 px-4 py-2 text-sm font-medium text-brand-800 transition hover:-translate-y-0.5 hover:bg-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Review Archived Reports</Link>
        </div>

        {saveMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">{saveMessage}</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        {insights ? (
          <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">2. Live Risk Insights</p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Overall Health Snapshot</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{insights.overall_health_snapshot}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">These insights are generated from your latest saved My Health baseline.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-brand-300/80 bg-brand-50/90 px-4 py-2 text-sm font-medium text-brand-800 transition hover:-translate-y-0.5 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                  onClick={onCopySummary}
                >
                  Copy Summary
                </button>
                <button
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-700/25 transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 dark:disabled:border dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                  onClick={onSaveReport}
                  disabled={savingReport || savedReportId !== null}
                >
                  {savedReportId ? "Snapshot Saved" : savingReport ? "Saving Snapshot..." : "Save Snapshot to Reports"}
                </button>
              </div>
            </div>
            {copyStatus === "success" ? <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">Summary copied to clipboard.</p> : null}
            {copyStatus === "error" ? <p className="text-xs font-medium text-rose-600 dark:text-rose-300">Unable to copy summary right now.</p> : null}

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
        ) : (
          <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">2. Live Risk Insights</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Generate your snapshot</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Save your profile baseline, then refresh insights to generate your current educational risk summary.</p>
          </section>
        )}
      </section>
    </RequireAuth>
  );
}
