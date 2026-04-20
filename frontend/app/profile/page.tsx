"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import {
  getHealthProfile,
  getMomentumHistory,
  getMomentumSummary,
  getUserErrorMessage,
  queryCoach,
  updateTodayMedicationStatus,
  upsertHealthProfile
} from "@/lib/api";
import {
  CoachQueryResponse,
  HealthProfile,
  MedicationAdherenceStatus,
  MedicationEntry,
  MedicationFrequency,
  MedicationTimeOfDay,
  MomentumSnapshot,
  MomentumSummaryResponse,
  UserTier
} from "@/lib/types";

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

type GuidancePlan = {
  snapshot: string;
  focus: string;
  goals: string[];
  watchlist: string[];
  refreshedAt: string;
};

const EMPTY_MEDICATION_DRAFT: MedicationDraft = {
  name: "",
  dosage: "",
  frequency: "daily",
  custom_frequency: "",
  time_of_day: "",
  notes: ""
};

const FREE_FEATURES = [
  "Baseline inputs",
  "Basic AI guidance",
  "Medication Tracker",
  "Reports",
  "Trends (basic)"
];

const PREMIUM_FEATURES = [
  "Daily adaptive coaching",
  "Ask AI unlimited",
  "Smart reminders",
  "Deep trend analytics",
  "Health score",
  "Goal streaks"
];

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

function calculateBmi(heightCm: number | null, weightKg: number | null) {
  if (!heightCm || !weightKg) return null;
  const heightMeters = heightCm / 100;
  if (!heightMeters) return null;
  return Number((weightKg / (heightMeters * heightMeters)).toFixed(1));
}

function addGoal(goals: string[], goal: string) {
  if (!goals.includes(goal) && goals.length < 5) {
    goals.push(goal);
  }
}

function buildGuidance(profile: HealthProfile): GuidancePlan {
  const goals: string[] = [];
  const watchlist: string[] = [];
  const positives: string[] = [];
  const improvements: string[] = [];
  const bmi = calculateBmi(profile.height_cm, profile.weight_kg);

  if (profile.activity_level === "active" || profile.activity_level === "very_active") {
    positives.push("active lifestyle habits");
  } else if (profile.activity_level === "low") {
    improvements.push("movement consistency");
    addGoal(goals, "Complete 3 walks or workouts this week.");
  }

  if ((profile.sleep_average_hours ?? 0) >= 7) {
    positives.push("restorative sleep range");
  } else if ((profile.sleep_average_hours ?? 0) > 0 && (profile.sleep_average_hours ?? 0) < 7) {
    improvements.push("sleep consistency");
    watchlist.push("Low sleep consistency");
    addGoal(goals, "Reach 7+ hours of sleep on at least 4 nights.");
  }

  if (profile.stress_level === "high" || profile.stress_level === "very_high") {
    improvements.push("stress recovery");
    addGoal(goals, "Schedule one 10-minute decompression routine each workday.");
  }

  if (profile.smoking_vaping_status === "occasional" || profile.smoking_vaping_status === "daily") {
    watchlist.push("Smoking/vaping risk");
    addGoal(goals, "Set one smoke-free streak target this week.");
  }

  if (profile.alcohol_frequency === "several_times_weekly" || profile.alcohol_frequency === "daily") {
    watchlist.push("Frequent alcohol intake");
    addGoal(goals, "Reduce alcohol intake by 1-2 nights this week.");
  }

  if (bmi && bmi >= 27) {
    watchlist.push("Elevated BMI trend");
    addGoal(goals, "Prioritize movement + nutrition consistency for 5 days.");
  }

  if (profile.family_history.length > 0) {
    watchlist.push("Family history cardiovascular/metabolic risk");
  }

  if (profile.medications.length > 0) {
    addGoal(goals, "Maintain medication adherence daily.");
  }

  if (goals.length < 3) {
    addGoal(goals, "Hydrate consistently and follow regular meal timing.");
    addGoal(goals, "Review baseline metrics once before week end.");
  }

  const focus =
    (profile.sleep_average_hours ?? 0) < 7
      ? "Recovery & Consistency"
      : profile.stress_level === "high" || profile.stress_level === "very_high"
        ? "Stress Reset"
        : profile.activity_level === "low"
          ? "Movement Momentum"
          : "Sustain Your Momentum";

  const snapshot =
    positives.length > 0
      ? `You maintain a solid baseline with ${positives.join(" and ")}. ${improvements.length ? `Your highest leverage area next is ${improvements[0]}.` : "Keep building consistency to preserve long-term gains."}`
      : `Your baseline has meaningful opportunity in ${improvements[0] ?? "consistency"}. Small weekly actions will create measurable momentum.`;

  return {
    snapshot,
    focus,
    goals: goals.slice(0, 5),
    watchlist,
    refreshedAt: new Date().toISOString()
  };
}

function calculateMomentumScore(profile: HealthProfile) {
  const sleepScore = (profile.sleep_average_hours ?? 0) >= 7 ? 100 : (profile.sleep_average_hours ?? 0) >= 6 ? 70 : 45;
  const activityScore = profile.activity_level === "very_active" ? 95 : profile.activity_level === "active" ? 85 : profile.activity_level === "moderate" ? 68 : profile.activity_level === "low" ? 35 : 55;
  const stressScore = profile.stress_level === "low" ? 92 : profile.stress_level === "moderate" ? 75 : profile.stress_level === "high" ? 50 : profile.stress_level === "very_high" ? 32 : 60;
  const events = profile.recent_medication_events ?? [];
  const adherenceScore = events.length ? Math.round((events.filter((event) => event.status === "taken").length / events.length) * 100) : 70;
  return Math.max(0, Math.min(100, Math.round((sleepScore + activityScore + stressScore + adherenceScore + profileCompletion(profile)) / 5)));
}

function momentumMeta(score: number) {
  if (score <= 39) return { label: "Needs Attention", ring: "text-rose-500", chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200" };
  if (score <= 59) return { label: "Building Momentum", ring: "text-amber-500", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" };
  if (score <= 79) return { label: "Stable", ring: "text-blue-500", chip: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200" };
  return { label: "Strong Routine", ring: "text-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<HealthProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [medicationDraft, setMedicationDraft] = useState<MedicationDraft>(EMPTY_MEDICATION_DRAFT);
  const [updatingMedicationId, setUpdatingMedicationId] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<GuidancePlan | null>(null);
  const [refreshingGuidance, setRefreshingGuidance] = useState(false);
  const [momentumHistory, setMomentumHistory] = useState<MomentumSnapshot[]>([]);
  const [momentumSummary, setMomentumSummary] = useState<MomentumSummaryResponse | null>(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachAnswer, setCoachAnswer] = useState<CoachQueryResponse | null>(null);

  // Foundation for free vs premium feature-gating.
  const [userTier] = useState<UserTier>("free");
  const completionPercent = useMemo(() => profileCompletion(profile), [profile]);
  const todaysStatusByMedicationId = useMemo(
    () => new Map((profile.todays_medication_status ?? []).map((entry) => [entry.medication_id, entry.status])),
    [profile.todays_medication_status]
  );
  const medicationsDueToday = useMemo(
    () => profile.medications.filter((medication) => medication.frequency !== "as_needed"),
    [profile.medications]
  );
  const momentumScore = useMemo(() => calculateMomentumScore(profile), [profile]);
  const momentumInfo = useMemo(() => momentumMeta(momentumScore), [momentumScore]);
  const ringProgress = useMemo(() => Math.round((momentumScore / 100) * 283), [momentumScore]);
  const isPremium = userTier === "premium";

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
        const hydratedProfile = {
          ...EMPTY_PROFILE,
          ...response,
          medications: normalizedMedications,
          current_medications: normalizeMedicationNames(normalizedMedications)
        };
        setProfile(hydratedProfile);
        setGuidance(buildGuidance(hydratedProfile));
        const [historyResponse, summaryResponse] = await Promise.all([getMomentumHistory(), getMomentumSummary()]);
        setMomentumHistory(historyResponse.snapshots);
        setMomentumSummary(summaryResponse);
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
      setGuidance(buildGuidance({
        ...response,
        medications: response.medications ?? [],
        current_medications: normalizeMedicationNames(response.medications ?? [])
      }));
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
      const normalizedResponse = {
        ...response,
        medications: response.medications ?? [],
        current_medications: normalizeMedicationNames(response.medications ?? [])
      };
      setProfile(normalizedResponse);
      setGuidance(buildGuidance(normalizedResponse));
      const [historyResponse, summaryResponse] = await Promise.all([getMomentumHistory(), getMomentumSummary()]);
      setMomentumHistory(historyResponse.snapshots);
      setMomentumSummary(summaryResponse);
      setSaveMessage("Plan updated. Your personalized guidance has been refreshed.");
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to save health profile."));
    } finally {
      setSaving(false);
    }
  }

  function onRefreshGuidance() {
    setRefreshingGuidance(true);
    setError(null);
    window.setTimeout(() => {
      setGuidance(buildGuidance(profile));
      setRefreshingGuidance(false);
    }, 250);
  }

  async function onAskCoach(question: string) {
    const text = question.trim();
    if (!text) return;
    setCoachLoading(true);
    setCoachQuestion(text);
    try {
      const response = await queryCoach({ question: text });
      setCoachAnswer(response);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to get coach response right now."));
    } finally {
      setCoachLoading(false);
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Health Coaching Workspace</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Update your health baseline, receive personalized guidance, and track long-term progress.
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
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Complete key basics for better weekly guidance quality.</p>
          </article>

          <article className="premium-card p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Last updated</p>
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{profile.updated_at ? new Date(profile.updated_at).toLocaleString() : "Not saved yet"}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Saved to your account for continuity across sessions.</p>
          </article>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="premium-card space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Health Baseline Inputs</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Core profile</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Age</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.age ?? ""} onChange={(event) => updateField("age", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Sex</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.sex ?? ""} onChange={(event) => updateField("sex", (event.target.value || null) as HealthProfile["sex"])}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
              <label className="space-y-1 text-sm"><span>Height (cm)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.height_cm ?? ""} onChange={(event) => updateField("height_cm", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm"><span>Weight (kg)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.weight_kg ?? ""} onChange={(event) => updateField("weight_kg", event.target.value ? Number(event.target.value) : null)} /></label>
            </div>
          </article>

          <article className="premium-card space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Health Baseline Inputs</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Lifestyle snapshot</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Activity level</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.activity_level ?? ""} onChange={(event) => updateField("activity_level", (event.target.value || null) as HealthProfile["activity_level"])}><option value="">Select</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very active</option></select></label>
              <label className="space-y-1 text-sm"><span>Smoking / vaping</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.smoking_vaping_status ?? ""} onChange={(event) => updateField("smoking_vaping_status", (event.target.value || null) as HealthProfile["smoking_vaping_status"])}><option value="">Select</option><option value="none">None</option><option value="former">Former</option><option value="occasional">Occasional</option><option value="daily">Daily</option></select></label>
              <label className="space-y-1 text-sm"><span>Alcohol frequency</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.alcohol_frequency ?? ""} onChange={(event) => updateField("alcohol_frequency", (event.target.value || null) as HealthProfile["alcohol_frequency"])}><option value="">Select</option><option value="never">Never</option><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="several_times_weekly">Several times weekly</option><option value="daily">Daily</option></select></label>
              <label className="space-y-1 text-sm"><span>Sleep average (hours)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" step="0.5" value={profile.sleep_average_hours ?? ""} onChange={(event) => updateField("sleep_average_hours", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="space-y-1 text-sm sm:col-span-2"><span>Stress level</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.stress_level ?? ""} onChange={(event) => updateField("stress_level", (event.target.value || null) as HealthProfile["stress_level"])}><option value="">Select</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="very_high">Very high</option></select></label>
            </div>
          </article>

          <article className="premium-card space-y-4 p-5 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Health Baseline Inputs</p>
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

        <section className="space-y-4 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/80 to-cyan-50/70 p-5 dark:border-brand-900/50 dark:from-slate-900 dark:to-slate-900/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Your AI Health Guidance</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Weekly coaching plan</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Guidance is personalized from your saved baseline and refreshed each time you update your profile.</p>
            </div>
            <p className="rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Refreshed {guidance?.refreshedAt ? new Date(guidance.refreshedAt).toLocaleString() : "Not yet"}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Snapshot Summary</h3>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{guidance?.snapshot ?? "Save your profile to generate your first personalized snapshot."}</p>
            </article>
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">This Week&apos;s Focus</h3>
              <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">{guidance?.focus ?? "Complete your baseline"}</p>
            </article>
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Recommended Goals</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                {(guidance?.goals ?? []).map((goal) => <li key={goal}>{goal}</li>)}
              </ul>
            </article>
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Risk Watchlist</h3>
              {(guidance?.watchlist?.length ?? 0) > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                  {guidance?.watchlist.map((risk) => <li key={risk}>{risk}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No major watchlist flags from current profile data.</p>
              )}
            </article>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Momentum</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Momentum Score</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Your score reflects consistency across sleep, movement, stress, adherence, and baseline completeness.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="premium-card p-5">
              <div className="flex items-center gap-6">
                <div className="relative h-28 w-28">
                  <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-700" />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray="283"
                      strokeDashoffset={283 - ringProgress}
                      strokeLinecap="round"
                      className={`${momentumInfo.ring} transition-all duration-700 ease-out`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-slate-900 dark:text-slate-100">{momentumScore}</div>
                </div>
                <div className="space-y-2">
                  <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${momentumInfo.chip}`}>{momentumInfo.label}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {momentumSummary?.weekly_delta
                      ? `${momentumSummary.weekly_delta > 0 ? "+" : ""}${momentumSummary.weekly_delta} this week`
                      : "unchanged this week"}
                  </p>
                </div>
              </div>
            </article>
            <article className="premium-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Momentum Over Time</h3>
              <div className="mt-3 grid grid-cols-10 items-end gap-1">
                {momentumHistory.slice(0, 10).reverse().map((entry) => (
                  <div key={entry.id} className="rounded-t bg-gradient-to-t from-brand-500 to-cyan-400" style={{ height: `${Math.max(12, entry.score)}px` }} title={`${entry.score} on ${new Date(entry.created_at).toLocaleDateString()}`} />
                ))}
              </div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                <p>Trend: <span className="font-semibold">{momentumSummary?.trend_direction ?? "Stable"}</span></p>
                <p>Best (30d): <span className="font-semibold">{momentumSummary?.stats.best_score_last_30_days ?? "-"}</span></p>
                <p>Average: <span className="font-semibold">{momentumSummary?.stats.average_score_last_30_days ?? "-"}</span></p>
                <p>Current streak: <span className="font-semibold">{momentumSummary?.stats.current_streak ?? 0}</span></p>
              </div>
            </article>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">AI Coach</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Personal Coach V2</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Based on your current profile</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["How do I improve my score?", "What should I focus on this week?", "What should I ask my doctor?"].map((prompt) => (
              <button key={prompt} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" onClick={() => onAskCoach(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={coachQuestion} onChange={(event) => setCoachQuestion(event.target.value)} placeholder="Ask your coach..." className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={coachLoading} onClick={() => onAskCoach(coachQuestion)}>
              {coachLoading ? "Thinking..." : "Ask"}
            </button>
          </div>
          <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/55 dark:text-slate-200">
            {coachLoading ? "Analyzing your profile and trend..." : coachAnswer?.answer ?? "Ask a question to get personalized guidance tied to your momentum, watchlist, and baseline."}
          </article>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={onSaveProfile} disabled={saving}>{saving ? "Saving..." : "Save & Update Plan"}</button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onClick={onRefreshGuidance} disabled={refreshingGuidance}>{refreshingGuidance ? "Refreshing..." : "Refresh Guidance"}</button>
          <Link href="/health-trends" className="rounded-lg border border-brand-300/80 bg-brand-50/90 px-4 py-2 text-sm font-medium text-brand-800 transition hover:-translate-y-0.5 hover:bg-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">View Trends</Link>
          <Link href="/history" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Reports History</Link>
        </div>

        {saveMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">{saveMessage}</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Medication Tracker</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Medication Tracker V2</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Manage active medications and adherence after reviewing your weekly plan.</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Notifications foundation</p>
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

        <section className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Premium Preview</p>
              <h2 className="mt-1 text-xl font-semibold">Unlock Premium Health Coaching</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">Upgrade for deeper automation and adaptive coaching built on top of your existing baseline, guidance, and adherence data.</p>
            </div>
            <span className="rounded-full border border-amber-200/50 bg-amber-100/10 px-3 py-1 text-xs font-semibold text-amber-200">
              {isPremium ? "Premium Active" : "Locked on Free"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-600/70 bg-slate-900/60 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Free Access</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                {FREE_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </article>
            <article className="rounded-xl border border-amber-300/40 bg-amber-100/10 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-200">Premium Includes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100">
                {PREMIUM_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </article>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-200">Upgrade to Premium</button>
            <button className="rounded-lg border border-slate-500 bg-transparent px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800">Learn More</button>
          </div>
        </section>
      </section>
    </RequireAuth>
  );
}
