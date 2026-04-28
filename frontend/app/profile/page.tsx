"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import {
  getCoachHistory,
  getHealthProfile,
  getRecentCheckIns,
  getTodayCheckIn,
  getUserErrorMessage,
  queryCoach,
  updateTodayMedicationStatus,
  upsertHealthProfile,
  upsertTodayCheckIn
} from "@/lib/api";
import {
  CoachMessage,
  DailyCheckIn,
  DailyCheckInUpsertRequest,
  HealthProfile,
  MedicationAdherenceStatus,
  MedicationEntry,
  MedicationFrequency,
  MedicationTimeOfDay,
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
  todaysSmallWin: string;
  goals: string[];
  watchlist: string[];
  whyThisMatters: string;
  refreshedAt: string;
};

type MomentumScore = {
  score: number;
  label: "Needs Attention" | "Building Momentum" | "Stable" | "Strong Routine";
  explanation: string;
  improvingSignals: string[];
  draggingSignals: string[];
};

const EMPTY_MEDICATION_DRAFT: MedicationDraft = {
  name: "",
  dosage: "",
  frequency: "daily",
  custom_frequency: "",
  time_of_day: "",
  notes: ""
};

const FREE_FEATURES = ["Momentum Score", "Weekly coaching plan", "Medication tracker", "Structured AI coach prompts", "Trends overview"];

const PREMIUM_FEATURES = ["Adaptive coaching routines", "Long-term momentum history", "Advanced reminder flows", "Deeper AI guidance personalization", "Expanded trend analytics"];

const COACH_SUGGESTED_PROMPTS = [
  "Why is my energy low?",
  "What should I focus on tomorrow?",
  "How can I improve my momentum score?",
  "Make this week’s plan easier",
  "What should I ask my doctor next?"
];

const COACH_QUICK_FILL_PROMPTS = ["What should I focus on tomorrow?", "Make this week’s plan easier"];

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

function calculateMedicationAdherenceSignal(profile: HealthProfile) {
  const events = profile.recent_medication_events ?? [];
  if (!events.length) {
    return { score: 0, summary: "No recent adherence logs yet." };
  }

  const takenCount = events.filter((event) => event.status === "taken").length;
  const adherenceRate = takenCount / events.length;

  if (adherenceRate >= 0.8) {
    return { score: 10, summary: "Recent medication logs show strong adherence." };
  }

  if (adherenceRate >= 0.5) {
    return { score: 5, summary: "Medication adherence is present but inconsistent." };
  }

  return { score: 0, summary: "Medication routine is currently inconsistent." };
}

function calculateMomentumScore(profile: HealthProfile): MomentumScore {
  const improvingSignals: string[] = [];
  const draggingSignals: string[] = [];
  const completion = profileCompletion(profile);

  let score = 0;

  const completionPoints = Math.round(completion * 0.22);
  score += completionPoints;
  if (completion >= 75) {
    improvingSignals.push("Baseline profile is mostly complete");
  } else {
    draggingSignals.push("Profile baseline is still incomplete");
  }

  if ((profile.sleep_average_hours ?? 0) >= 7 && (profile.sleep_average_hours ?? 0) <= 9) {
    score += 18;
    improvingSignals.push("Sleep is within a steady recovery range");
  } else if ((profile.sleep_average_hours ?? 0) > 0) {
    score += 8;
    draggingSignals.push("Sleep consistency is below target");
  } else {
    draggingSignals.push("Sleep data is missing");
  }

  if (profile.activity_level === "very_active") {
    score += 18;
    improvingSignals.push("Activity level is very strong");
  } else if (profile.activity_level === "active") {
    score += 15;
    improvingSignals.push("Activity routine is strong");
  } else if (profile.activity_level === "moderate") {
    score += 10;
  } else if (profile.activity_level === "low") {
    score += 4;
    draggingSignals.push("Movement routine can improve");
  }

  if (profile.smoking_vaping_status === "none" || profile.smoking_vaping_status === "former") {
    score += 10;
  } else if (profile.smoking_vaping_status === "occasional") {
    score += 4;
    draggingSignals.push("Smoking/vaping is still present");
  } else if (profile.smoking_vaping_status === "daily") {
    score += 0;
    draggingSignals.push("Daily smoking/vaping is lowering momentum");
  }

  if (profile.stress_level === "low") {
    score += 14;
    improvingSignals.push("Stress load appears manageable");
  } else if (profile.stress_level === "moderate") {
    score += 10;
  } else if (profile.stress_level === "high") {
    score += 4;
    draggingSignals.push("Stress load is elevated");
  } else if (profile.stress_level === "very_high") {
    score += 1;
    draggingSignals.push("Stress load needs near-term support");
  }

  const medicationSignal = calculateMedicationAdherenceSignal(profile);
  score += medicationSignal.score;
  if (profile.medications.length > 0) {
    if (medicationSignal.score >= 8) {
      improvingSignals.push("Medication adherence routine is consistent");
    } else {
      draggingSignals.push(medicationSignal.summary);
    }
  }

  if (profile.weekly_health_summary_enabled) {
    score += 4;
    improvingSignals.push("Weekly summary reminders are enabled");
  } else {
    draggingSignals.push("Weekly summary reminder is not enabled");
  }

  if (profile.medication_reminders_enabled && profile.medications.length > 0) {
    score += 4;
    improvingSignals.push("Medication reminders are configured");
  }

  score = Math.max(0, Math.min(100, score));

  const label =
    score < 40
      ? "Needs Attention"
      : score < 60
        ? "Building Momentum"
        : score < 80
          ? "Stable"
          : "Strong Routine";

  const explanation =
    improvingSignals.length > 0
      ? `Your score reflects progress in ${improvingSignals[0].toLowerCase()}. Next improvement: ${(draggingSignals[0] ?? "keep your routines consistent").toLowerCase()}.`
      : `Your score is currently driven by missing or inconsistent routine signals. Start with one small weekly action.`;

  return {
    score,
    label,
    explanation,
    improvingSignals: improvingSignals.slice(0, 3),
    draggingSignals: draggingSignals.slice(0, 3)
  };
}

function buildGuidance(profile: HealthProfile, momentum: MomentumScore): GuidancePlan {
  const goals: string[] = [];
  const watchlist: string[] = [];
  const positives: string[] = [];
  const improvements: string[] = [];
  const bmi = calculateBmi(profile.height_cm, profile.weight_kg);

  if (profile.activity_level === "active" || profile.activity_level === "very_active") {
    positives.push("movement consistency");
  } else if (profile.activity_level === "low") {
    improvements.push("daily movement");
    addGoal(goals, "Walk 20 minutes after work on 4 days this week.");
  }

  if ((profile.sleep_average_hours ?? 0) >= 7) {
    positives.push("sleep recovery");
  } else if ((profile.sleep_average_hours ?? 0) > 0 && (profile.sleep_average_hours ?? 0) < 7) {
    improvements.push("sleep consistency");
    watchlist.push("Sleep debt trend");
    addGoal(goals, "Reach 7+ hours of sleep for at least 4 nights.");
  }

  if (profile.stress_level === "high" || profile.stress_level === "very_high") {
    improvements.push("stress decompression");
    watchlist.push("High stress load");
    addGoal(goals, "Book a 10-minute reset block during each workday.");
  }

  if (profile.smoking_vaping_status === "occasional" || profile.smoking_vaping_status === "daily") {
    watchlist.push("Smoking/vaping risk");
    addGoal(goals, "Set one smoke-free streak goal for this week.");
  }

  if (profile.alcohol_frequency === "several_times_weekly" || profile.alcohol_frequency === "daily") {
    watchlist.push("Frequent alcohol intake");
    addGoal(goals, "Reduce alcohol nights by 1 this week.");
  }

  if (bmi && bmi >= 27) {
    watchlist.push("Elevated BMI trend");
    addGoal(goals, "Pair 5 movement days with a consistent dinner routine.");
  }

  if (profile.medications.length > 0) {
    addGoal(goals, "Mark each scheduled medication as taken or skipped.");
  }

  if (!profile.weekly_health_summary_enabled) {
    addGoal(goals, "Enable weekly summary to keep your plan visible.");
  }

  if (goals.length < 3) {
    addGoal(goals, "Hydrate consistently and keep regular meal timing.");
    addGoal(goals, "Review your trend snapshot once before Sunday.");
  }

  const focus =
    momentum.label === "Needs Attention"
      ? "Reset Fundamentals"
      : (profile.sleep_average_hours ?? 0) < 7
        ? "Recovery & Consistency"
        : profile.activity_level === "low"
          ? "Movement Momentum"
          : "Protect Your Routine";

  const todaysSmallWin =
    (profile.sleep_average_hours ?? 0) < 7
      ? "Set a wind-down alarm 45 minutes before bedtime."
      : profile.activity_level === "low"
        ? "Take a 20-minute walk before dinner."
        : profile.stress_level === "high" || profile.stress_level === "very_high"
          ? "Use one 10-minute breathing break this afternoon."
          : "Repeat your strongest habit from yesterday.";

  const whyThisMatters =
    (profile.sleep_average_hours ?? 0) < 7
      ? "Better sleep consistency can improve energy, stress resilience, and recovery momentum."
      : profile.activity_level === "low"
        ? "More daily movement supports long-term cardiovascular and metabolic health."
        : "Consistency in routines helps protect your baseline and reduces backsliding risk.";

  const snapshot =
    positives.length > 0
      ? `You are building from ${positives.join(" and ")}. Keep that base steady while improving ${improvements[0] ?? "consistency"}.`
      : "Your plan starts with core consistency habits. Small weekly wins can quickly lift your momentum score.";

  return {
    snapshot,
    focus,
    todaysSmallWin,
    goals: goals.slice(0, 5),
    watchlist,
    whyThisMatters,
    refreshedAt: new Date().toISOString()
  };
}

function deriveCoachInsight(
  weeklySummary: {
    averageSleep: string;
    averageEnergy: string;
    stressPattern: string;
    exerciseSummary: string;
    completion: string;
    takeaway: string;
  },
  momentum: MomentumScore,
  streakHighlights: { label: string; value: string }[],
  recentCheckIns: DailyCheckIn[]
) {
  const hasLowSleepTakeaway = weeklySummary.takeaway.toLowerCase().includes("sleep");
  const energySignals = recentCheckIns.filter((entry) => typeof entry.energy_level === "number").map((entry) => entry.energy_level as number);
  const lowEnergyCount = energySignals.filter((value) => value <= 5).length;
  const checkInStreakValue = streakHighlights.find((item) => item.label === "Daily check-ins")?.value ?? "0 day streak";

  if (hasLowSleepTakeaway || lowEnergyCount >= 2) {
    return "Coach Insight: Energy is softer on lower-recovery days—protect sleep consistency tonight for your fastest momentum gain.";
  }

  if (momentum.score < 60) {
    return `Coach Insight: Momentum is ${momentum.label.toLowerCase()}; the fastest next win is keeping your check-in streak active (${checkInStreakValue}).`;
  }

  if (weeklySummary.stressPattern.toLowerCase().includes("high stress")) {
    return "Coach Insight: Stress load looks elevated this week—keep tomorrow simple with one recovery block and one manageable priority.";
  }

  return "Coach Insight: Your routines are fairly steady; lock in one repeatable habit tomorrow to convert consistency into stronger momentum.";
}

function buildCoachMemorySummary(
  question: string,
  answer: string,
  weeklyTakeaway: string,
  momentum: MomentumScore,
  recentCheckIns: DailyCheckIn[]
) {
  const lowerQuestion = question.toLowerCase();
  const topic = lowerQuestion.includes("energy")
    ? "low energy"
    : lowerQuestion.includes("sleep")
      ? "sleep"
      : lowerQuestion.includes("stress")
        ? "stress"
        : lowerQuestion.includes("tomorrow")
          ? "tomorrow's focus"
          : "weekly priorities";
  const withSleep = recentCheckIns.filter((entry) => typeof entry.sleep_hours === "number");
  const averageSleep =
    withSleep.length > 0 ? (withSleep.reduce((sum, entry) => sum + (entry.sleep_hours ?? 0), 0) / withSleep.length).toFixed(1) : null;
  const answerLeansSleep = answer.toLowerCase().includes("sleep");
  const primaryLever = answerLeansSleep || weeklyTakeaway.toLowerCase().includes("sleep") ? "sleep consistency" : "daily consistency";

  return `User asked about ${topic}. Current coaching context points to ${primaryLever}, ${momentum.label.toLowerCase()} momentum (${momentum.score}/100)${averageSleep ? `, and recent sleep around ${averageSleep}h.` : "."}`;
}

function emptyCheckInDraft(): DailyCheckInUpsertRequest {
  return {
    sleep_hours: null,
    energy_level: null,
    stress_level: null,
    exercised_today: null,
    note: null
  };
}

function checkInCompletionLabel(checkIn: DailyCheckIn | null) {
  return checkIn ? "Completed" : "Not completed yet";
}

function calculateCheckInStreak(recentCheckIns: DailyCheckIn[]) {
  if (!recentCheckIns.length) return 0;
  const checkInDays = new Set(
    recentCheckIns.map((entry) => new Date(entry.date).toISOString().slice(0, 10))
  );
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  let streak = 0;
  while (checkInDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calculateSleepStreak(recentCheckIns: DailyCheckIn[], targetHours = 7) {
  if (!recentCheckIns.length) return 0;
  const ordered = [...recentCheckIns]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let streak = 0;
  for (const entry of ordered) {
    if ((entry.sleep_hours ?? 0) >= targetHours) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function calculateMedicationStreak(profile: HealthProfile) {
  const events = profile.recent_medication_events ?? [];
  if (!events.length) return 0;
  const byDay = new Map<string, MedicationAdherenceStatus[]>();
  for (const event of events) {
    const day = new Date(event.event_date).toISOString().slice(0, 10);
    const existing = byDay.get(day) ?? [];
    existing.push(event.status);
    byDay.set(day, existing);
  }

  const orderedDays = [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1));
  let streak = 0;
  for (const day of orderedDays) {
    const statuses = byDay.get(day) ?? [];
    if (statuses.length > 0 && statuses.every((status) => status !== "skipped")) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

export default function ProfilePage() {

  const [profile, setProfile] = useState<HealthProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [medicationDraft, setMedicationDraft] = useState<MedicationDraft>(EMPTY_MEDICATION_DRAFT);
  const [updatingMedicationId, setUpdatingMedicationId] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<GuidancePlan | null>(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachMemorySummary, setCoachMemorySummary] = useState<string | null>(null);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<DailyCheckIn[]>([]);
  const [checkInDraft, setCheckInDraft] = useState<DailyCheckInUpsertRequest>(emptyCheckInDraft());
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const [userTier] = useState<UserTier>("free");
  const completionPercent = useMemo(() => profileCompletion(profile), [profile]);
  const momentum = useMemo(() => calculateMomentumScore(profile), [profile]);
  const todaysStatusByMedicationId = useMemo(
    () => new Map((profile.todays_medication_status ?? []).map((entry) => [entry.medication_id, entry.status])),
    [profile.todays_medication_status]
  );
  const medicationsDueToday = useMemo(
    () => profile.medications.filter((medication) => medication.frequency !== "as_needed"),
    [profile.medications]
  );
  const trendSignal = useMemo(
    () =>
      momentum.score >= 75
        ? "Momentum trend is improving compared with baseline setup habits."
        : momentum.score >= 50
          ? "Momentum is steady; refining one daily habit could lift next week."
          : "Momentum is early-stage; focus on one foundational routine this week.",
    [momentum.score]
  );
  const checkInStreak = useMemo(() => calculateCheckInStreak(recentCheckIns), [recentCheckIns]);
  const sleepStreak = useMemo(() => calculateSleepStreak(recentCheckIns), [recentCheckIns]);
  const medicationStreak = useMemo(() => calculateMedicationStreak(profile), [profile]);
  const weeklySummary = useMemo(() => {
    if (!recentCheckIns.length) {
      return {
        averageSleep: "No check-ins yet",
        averageEnergy: "No check-ins yet",
        stressPattern: "Not enough stress data yet",
        exerciseSummary: "0 active days tracked",
        completion: "0 of 7 days",
        takeaway: "Start with a quick daily check-in to unlock a meaningful weekly pattern summary."
      };
    }

    const withSleep = recentCheckIns.filter((entry) => typeof entry.sleep_hours === "number");
    const withEnergy = recentCheckIns.filter((entry) => typeof entry.energy_level === "number");
    const stressEntries = recentCheckIns.map((entry) => entry.stress_level).filter(Boolean);
    const exerciseCount = recentCheckIns.filter((entry) => entry.exercised_today).length;
    const averageSleepValue =
      withSleep.length > 0 ? withSleep.reduce((sum, entry) => sum + (entry.sleep_hours ?? 0), 0) / withSleep.length : 0;
    const averageEnergyValue =
      withEnergy.length > 0 ? withEnergy.reduce((sum, entry) => sum + (entry.energy_level ?? 0), 0) / withEnergy.length : 0;
    const stressPattern =
      stressEntries.filter((level) => level === "high").length >= 2
        ? "High stress appeared frequently"
        : stressEntries.filter((level) => level === "moderate").length >= 2
          ? "Mostly moderate stress days"
          : "Mostly low-to-moderate stress days";

    return {
      averageSleep: withSleep.length > 0 ? `${averageSleepValue.toFixed(1)}h` : "No sleep logs",
      averageEnergy: withEnergy.length > 0 ? `${averageEnergyValue.toFixed(1)}/10` : "No energy logs",
      stressPattern,
      exerciseSummary: `${exerciseCount} active day${exerciseCount === 1 ? "" : "s"} tracked`,
      completion: `${recentCheckIns.length} of 7 days`,
      takeaway:
        averageSleepValue < 7 && averageEnergyValue < 7
          ? "Energy softened on lower-sleep days this week. Protecting sleep consistency is your highest-leverage move."
          : "This week shows stable routines with room to tighten one recovery habit for smoother daily energy."
    };
  }, [recentCheckIns]);
  const todaysFocus = guidance?.todaysSmallWin ?? "Complete your baseline to unlock today’s focus.";
  const todaysNextAction = todayCheckIn
    ? "Review your weekly plan and repeat your strongest routine."
    : "Complete today’s check-in to keep your momentum and coaching context up to date.";
  const miniInsight =
    profile.sleep_average_hours && profile.sleep_average_hours < 7
      ? "Sleep consistency is your biggest lever this week."
      : profile.stress_level === "high" || profile.stress_level === "very_high"
        ? "Reducing stress spikes can quickly improve daily momentum."
        : "Protecting your strongest routine compounds progress week to week.";
  const streakHighlights = useMemo(
    () => [
      { label: "Daily check-ins", value: `${checkInStreak} day streak` },
      { label: "Sleep target", value: `${sleepStreak} strong night${sleepStreak === 1 ? "" : "s"}` },
      { label: "Medication adherence", value: `${medicationStreak} day streak` }
    ],
    [checkInStreak, medicationStreak, sleepStreak]
  );
  const coachContextPayload = useMemo(
    () => ({
      weeklySummary,
      momentum: {
        score: momentum.score,
        label: momentum.label,
        explanation: momentum.explanation
      },
      streakHighlights,
      goals: guidance?.goals ?? [],
      coachMemorySummary: coachMemorySummary ?? undefined,
      recentCheckIns: recentCheckIns.slice(0, 3).map((entry) => ({
        date: entry.date,
        sleep_hours: entry.sleep_hours,
        energy_level: entry.energy_level,
        stress_level: entry.stress_level,
        exercised_today: entry.exercised_today,
        note: entry.note
      }))
    }),
    [coachMemorySummary, guidance?.goals, momentum.explanation, momentum.label, momentum.score, recentCheckIns, streakHighlights, weeklySummary]
  );
  const isPremium = userTier === "premium";
  const coachInsight = useMemo(
    () => deriveCoachInsight(weeklySummary, momentum, streakHighlights, recentCheckIns),
    [momentum, recentCheckIns, streakHighlights, weeklySummary]
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
        const hydratedProfile = {
          ...EMPTY_PROFILE,
          ...response,
          medications: normalizedMedications,
          current_medications: normalizeMedicationNames(normalizedMedications)
        };
        setProfile(hydratedProfile);
        setGuidance(buildGuidance(hydratedProfile, calculateMomentumScore(hydratedProfile)));
        const [todayResponse, recentResponse, coachHistory] = await Promise.all([
          getTodayCheckIn(),
          getRecentCheckIns(7),
          getCoachHistory()
        ]);
        setTodayCheckIn(todayResponse);
        setRecentCheckIns(recentResponse.items);
        setCoachMessages(coachHistory.messages ?? []);
        setCoachMemorySummary(coachHistory.memory_summary ?? null);
        if (todayResponse) {
          setCheckInDraft({
            sleep_hours: todayResponse.sleep_hours,
            energy_level: todayResponse.energy_level,
            stress_level: todayResponse.stress_level,
            exercised_today: todayResponse.exercised_today,
            note: todayResponse.note
          });
        }
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
      const normalizedResponse = {
        ...response,
        medications: response.medications ?? [],
        current_medications: normalizeMedicationNames(response.medications ?? [])
      };
      setProfile(normalizedResponse);
      setSaveMessage("Medication adherence saved for today.");
      setGuidance(buildGuidance(normalizedResponse, calculateMomentumScore(normalizedResponse)));
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to update medication status."));
    } finally {
      setUpdatingMedicationId(null);
    }
  }

  function jumpToCoach() {
    setCoachQuestion((current) => current || "What should I prioritize today?");
    document.getElementById("coach-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onStartCheckIn() {
    setCheckInOpen(true);
    document.getElementById("daily-pulse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onAskCoach(event?: FormEvent) {
    event?.preventDefault();
    const question = coachQuestion.trim();
    if (!question || coachLoading) return;

    const nextMessages: CoachMessage[] = [...coachMessages, { role: "user", content: question }];
    setCoachMessages(nextMessages);
    setCoachQuestion("");
    setCoachLoading(true);

    try {
      const response = await queryCoach({ question, history: nextMessages, context: coachContextPayload });
      setCoachMessages((current) => [...current, { role: "coach", content: response.answer }]);
      setCoachMemorySummary(
        response.memory_summary ??
          buildCoachMemorySummary(question, response.answer, weeklySummary.takeaway, momentum, recentCheckIns)
      );
    } catch (err) {
      setCoachMessages((current) => [
        ...current,
        { role: "coach", content: getUserErrorMessage(err, "Coach is temporarily unavailable. Please try again in a moment.") }
      ]);
    } finally {
      setCoachLoading(false);
    }
  }

  async function onSaveTodayCheckIn(event?: FormEvent) {
    event?.preventDefault();
    setCheckInSaving(true);
    setError(null);

    try {
      const saved = await upsertTodayCheckIn(checkInDraft);
      setTodayCheckIn(saved);
      const recents = await getRecentCheckIns(7);
      setRecentCheckIns(recents.items);
      setSaveMessage("Today’s check-in saved.");
      setCheckInOpen(false);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to save today’s check-in."));
    } finally {
      setCheckInSaving(false);
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
      <section className="section-shell mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden px-4 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5 lg:px-8 lg:pb-7 lg:pt-6">
        <div className="ambient-orb -right-16 -top-12 h-40 w-40 bg-brand-300/25" />
        <div className="ambient-orb -bottom-20 left-0 h-56 w-56 bg-cyan-200/20" />

        <div className="relative space-y-3 border-b border-slate-200/80 pb-5 dark:border-slate-700/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">My Health</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Health Coaching Workspace</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Plan your week, track progress, and use AI coaching insights from one clean workspace.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Updated just now</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={jumpToCoach} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">Ask Coach</button>
          <button type="button" onClick={onStartCheckIn} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Complete Check-in</button>
        </div>

        {saveMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">{saveMessage}</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_300px] 2xl:items-start">
          <div className="min-w-0 space-y-4">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">1. AI Coach</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Coach workspace</h2>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <article className="premium-card min-w-0 lg:col-span-2 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Coaching context</h3>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{momentum.explanation}</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{trendSignal}</p>
              <div className="mt-3 rounded-lg border border-brand-200/90 bg-brand-50/70 p-3 dark:border-brand-900/60 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-brand-700 dark:text-brand-300">Coach Insight</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{coachInsight}</p>
              </div>
            </article>
            <article className="premium-card min-w-0 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Progress over time</h3>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Explore long-range patterns and prepare better coaching questions from trend history.</p>
              <Link href="/health-trends" className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Open Trends Workspace</Link>
            </article>
          </div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <article className="premium-card min-w-0 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">What&apos;s helping</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{momentum.improvingSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
            </article>
            <article className="premium-card min-w-0 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">What&apos;s dragging score</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{momentum.draggingSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
            </article>
          </div>

          <article id="coach-workspace" className="premium-card min-w-0 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Ask AI Health Coach</p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Coach chat workspace</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Personalized, educational coaching grounded in your baseline, momentum, medications, and daily check-ins.</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Using your profile, weekly summary, streaks, and recent check-ins.</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{coachMemorySummary ? "Coach memory active • Using saved coaching context" : "Memory begins after your first coach conversation"}</p>
              </div>
            </div>
            {coachMemorySummary ? (
              <details className="mt-3 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <summary className="cursor-pointer font-medium">What coach remembers</summary>
                <p className="mt-2">{coachMemorySummary}</p>
              </details>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {COACH_SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setCoachQuestion(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="mt-4 max-h-80 space-y-5 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              {coachMessages.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Start a conversation with your coach. Ask about this week, low energy patterns, stress, or momentum score changes.</p> : null}
              {coachMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`max-w-full break-words rounded-xl p-3.5 text-sm leading-relaxed ${message.role === "user" ? "bg-brand-700/95 text-white shadow-sm md:ml-10" : "border border-cyan-200/80 bg-cyan-50/90 text-slate-800 dark:border-cyan-900/60 dark:bg-cyan-950/35 dark:text-slate-100 md:mr-10"}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{message.role === "user" ? "You" : "Coach"}</p>
                  <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
              {coachLoading ? <p className="rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">Coach is thinking...</p> : null}
            </div>
            <form onSubmit={onAskCoach} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={coachQuestion}
                onChange={(event) => setCoachQuestion(event.target.value)}
                placeholder="Ask a coaching question..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <button type="submit" disabled={coachLoading} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{coachLoading ? "Thinking..." : "Ask Coach"}</button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {COACH_QUICK_FILL_PROMPTS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setCoachQuestion(suggestion)}
                  className="rounded-full border border-slate-300/90 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Educational only. Not medical diagnosis or emergency guidance.</p>
          </article>
        </section>
        <section id="daily-pulse" className="premium-card min-w-0 max-w-full overflow-x-hidden space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">2. Daily Pulse</p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Daily pulse</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Track your daily focus, next action, and signal.</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{checkInCompletionLabel(todayCheckIn)}</p>
              <button type="button" onClick={() => setCheckInOpen((current) => !current)} className="mt-2 rounded-lg bg-brand-700 px-3 py-2 text-xs font-medium text-white">{todayCheckIn ? "Update Today’s Check-In" : "Complete Today’s Check-In"}</button>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 lg:grid-cols-3">
            <article className="rounded-2xl border border-brand-200/90 bg-gradient-to-br from-brand-50/90 to-cyan-50/70 p-4 dark:border-brand-900/60 dark:from-slate-900 dark:to-slate-900/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Today&apos;s focus</p>
              <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{guidance?.focus ?? "Protect your routine"}</p>
            </article>
            <article className="rounded-xl border border-slate-200/90 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/65">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Next action</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{todaysNextAction}</p>
            </article>
            <article className="rounded-xl border border-cyan-200/80 bg-cyan-50/60 p-4 dark:border-cyan-900/70 dark:bg-cyan-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">Today&apos;s signal</p>
              <p className="mt-1 text-sm font-medium text-cyan-900 dark:text-cyan-100">{miniInsight}</p>
            </article>
          </div>
          {checkInOpen ? (
            <form onSubmit={onSaveTodayCheckIn} className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Sleep hours last night</span><input type="number" min={0} max={16} step="0.5" className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={checkInDraft.sleep_hours ?? ""} onChange={(event) => setCheckInDraft((current) => ({ ...current, sleep_hours: event.target.value ? Number(event.target.value) : null }))} /></label>
              <label className="space-y-1 text-sm"><span>Energy today (1-10)</span><input type="number" min={1} max={10} className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={checkInDraft.energy_level ?? ""} onChange={(event) => setCheckInDraft((current) => ({ ...current, energy_level: event.target.value ? Number(event.target.value) : null }))} /></label>
              <label className="space-y-1 text-sm"><span>Stress today</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={checkInDraft.stress_level ?? ""} onChange={(event) => setCheckInDraft((current) => ({ ...current, stress_level: (event.target.value || null) as DailyCheckInUpsertRequest["stress_level"] }))}><option value="">Select</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
              <label className="space-y-1 text-sm"><span>Exercise today</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={checkInDraft.exercised_today === null ? "" : checkInDraft.exercised_today ? "yes" : "no"} onChange={(event) => setCheckInDraft((current) => ({ ...current, exercised_today: event.target.value === "" ? null : event.target.value === "yes" }))}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label className="space-y-1 text-sm md:col-span-2"><span>Note (optional)</span><textarea rows={2} maxLength={300} className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={checkInDraft.note ?? ""} onChange={(event) => setCheckInDraft((current) => ({ ...current, note: event.target.value || null }))} /></label>
              <div className="md:col-span-2"><button type="submit" disabled={checkInSaving} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{checkInSaving ? "Saving..." : "Save check-in"}</button></div>
            </form>
          ) : null}
          <div className="grid min-w-0 gap-2 md:grid-cols-3">
            {recentCheckIns.slice(0, 3).map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-200/80 bg-white/70 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{new Date(entry.date).toLocaleDateString()}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">Sleep {entry.sleep_hours ?? "—"}h · Energy {entry.energy_level ?? "—"}/10 · Stress {entry.stress_level ?? "—"}</p>
              </div>
            ))}
            {recentCheckIns.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">No check-ins yet. Add today’s entry to start trend tracking.</p> : null}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">3. Health Baseline</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Profile foundation</h2>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <article className="premium-card p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Profile completion</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{completionPercent}%</p>
              <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 ease-out" style={{ width: `${completionPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Complete key basics for better weekly coaching quality.</p>
            </article>

            <article className="premium-card p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Last updated</p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{profile.updated_at ? new Date(profile.updated_at).toLocaleString() : "Not saved yet"}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Saved to your account for continuity across sessions.</p>
            </article>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <article className="premium-card space-y-4 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Health Baseline Inputs</p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Core profile</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm"><span>Age</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.age ?? ""} onChange={(event) => updateField("age", event.target.value ? Number(event.target.value) : null)} /></label>
                <label className="space-y-1 text-sm"><span>Sex</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={profile.sex ?? ""} onChange={(event) => updateField("sex", (event.target.value || null) as HealthProfile["sex"])}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
                <label className="space-y-1 text-sm"><span>Height (cm)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.height_cm ?? ""} onChange={(event) => updateField("height_cm", event.target.value ? Number(event.target.value) : null)} /></label>
                <label className="space-y-1 text-sm"><span>Weight (kg)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.weight_kg ?? ""} onChange={(event) => updateField("weight_kg", event.target.value ? Number(event.target.value) : null)} /></label>
              </div>
            </article>

            <article className="premium-card space-y-4 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Health Baseline Inputs</p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Lifestyle snapshot</h3>
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
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">History + optional metrics</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm"><span>Known conditions</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. hypertension, asthma" value={joinList(profile.known_conditions)} onChange={(event) => updateField("known_conditions", parseList(event.target.value))} /></label>
                <div className="space-y-1 text-sm"><span>Current medications</span><div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">Managed below in Medication Tracker ({profile.medications.length} active).</div></div>
                <label className="space-y-1 text-sm md:col-span-2"><span>Family history</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. heart disease, type 2 diabetes" value={joinList(profile.family_history)} onChange={(event) => updateField("family_history", parseList(event.target.value))} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm"><span>Systolic BP (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.systolic_bp ?? ""} onChange={(event) => updateField("systolic_bp", event.target.value ? Number(event.target.value) : null)} /></label>
                <label className="space-y-1 text-sm"><span>Diastolic BP (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.diastolic_bp ?? ""} onChange={(event) => updateField("diastolic_bp", event.target.value ? Number(event.target.value) : null)} /></label>
                <label className="space-y-1 text-sm"><span>Total cholesterol (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" type="number" value={profile.total_cholesterol ?? ""} onChange={(event) => updateField("total_cholesterol", event.target.value ? Number(event.target.value) : null)} /></label>
              </div>
            </article>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="premium-card min-w-0 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">4. Momentum / Streak rail</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Momentum score</p>
                <p className="mt-1 text-4xl font-semibold text-slate-900 dark:text-slate-100">{momentum.score}</p>
              </div>
              <span className="rounded-full border border-cyan-300/70 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">{momentum.label}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${momentum.score}%` }} /></div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{trendSignal}</p>
          </article>
          <article className="premium-card min-w-0 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Streak highlights</p>
            <div className="mt-3 space-y-3">
              {streakHighlights.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="space-y-4 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/80 to-cyan-50/70 p-5 dark:border-brand-900/50 dark:from-slate-900 dark:to-slate-900/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">5. Weekly Coaching Plan</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Weekly coaching plan</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Actionable guidance from your current baseline and momentum context.</p>
            </div>
            <p className="rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">Refreshed {guidance?.refreshedAt ? new Date(guidance.refreshedAt).toLocaleString() : "Not yet"}</p>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Snapshot Summary</h3>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{guidance?.snapshot ?? "Save your profile to generate your first personalized snapshot."}</p>
            </article>
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">This Week&apos;s Focus</h3>
              <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">{guidance?.focus ?? "Complete your baseline"}</p>
            </article>
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Today&apos;s Small Win</h3>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{guidance?.todaysSmallWin ?? "Save your profile to generate today's small win."}</p>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Why this matters: {guidance?.whyThisMatters ?? "Small daily wins build weekly health momentum."}</p>
            </article>
            <article className="premium-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Watchlist</h3>
              {(guidance?.watchlist?.length ?? 0) > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{guidance?.watchlist.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No major watchlist flags from current profile data.</p>}
            </article>
          </div>
          <article className="premium-card min-w-0 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">This Week Summary</h3>
              <p className="rounded-full border border-slate-300/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">{weeklySummary.completion}</p>
            </div>
            <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60"><p className="text-[11px] uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">Avg sleep</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{weeklySummary.averageSleep}</p></div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60"><p className="text-[11px] uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">Avg energy</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{weeklySummary.averageEnergy}</p></div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60"><p className="text-[11px] uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">Stress pattern</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{weeklySummary.stressPattern}</p></div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60"><p className="text-[11px] uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">Exercise</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{weeklySummary.exerciseSummary}</p></div>
              <div className="rounded-xl border border-brand-200/90 bg-gradient-to-r from-brand-50/90 to-cyan-50/80 p-4 md:col-span-2 lg:col-span-3 xl:col-span-5 dark:border-brand-900/60 dark:from-slate-900 dark:to-slate-900/70"><p className="text-[11px] uppercase tracking-[0.13em] text-brand-700 dark:text-brand-300">Takeaway</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{weeklySummary.takeaway}</p></div>
            </div>
          </article>
          <article className="premium-card p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Recommended Goals</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{(guidance?.goals ?? []).map((goal) => <li key={goal}>{goal}</li>)}</ul>
          </article>
        </section>


        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">6. Medication / Reminders</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Medication tracker + reminders</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Keep your medication routine and reminder preferences aligned with your weekly coaching plan.</p>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
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
                        <button className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" onClick={() => onUpdateMedicationTodayStatus(medication.id, "taken")} disabled={updatingMedicationId === medication.id}>Taken</button>
                        <button className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-60 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" onClick={() => onUpdateMedicationTodayStatus(medication.id, "skipped")} disabled={updatingMedicationId === medication.id}>Skipped</button>
                      </div>
                    </div>
                  </div>
                )) : <p className="rounded-lg border border-dashed border-cyan-300/80 bg-white/70 p-3 text-xs text-cyan-900/80 dark:border-cyan-900/60 dark:bg-slate-900/60 dark:text-cyan-200/80">No scheduled medications for today yet.</p>}
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
                )) : <p className="rounded-lg border border-dashed border-slate-300/80 bg-white/80 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">No adherence history yet. Mark taken/skipped in Today&apos;s Medications.</p>}
              </div>
            </article>
          </div>

          <article className="premium-card min-w-0 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Reminder preferences</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reminders support medication routines, weekly summaries, and upcoming coaching prompts.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/70"><input type="checkbox" checked={profile.medication_reminders_enabled} onChange={(event) => updateField("medication_reminders_enabled", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-400" /><span><span className="font-medium text-slate-900 dark:text-slate-100">Medication reminders</span><span className="block text-xs text-slate-500 dark:text-slate-400">Guides daily medication consistency and adherence tracking.</span></span></label>
              <label className="space-y-1 text-sm"><span>Preferred reminder time</span><input type="time" value={profile.medication_reminder_time ?? "08:00"} onChange={(event) => updateField("medication_reminder_time", event.target.value || null)} className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" /></label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white/80 p-3 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-900/70"><input type="checkbox" checked={profile.weekly_health_summary_enabled} onChange={(event) => updateField("weekly_health_summary_enabled", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-400" /><span><span className="font-medium text-slate-900 dark:text-slate-100">Weekly health summary</span><span className="block text-xs text-slate-500 dark:text-slate-400">Receive a weekly educational recap of trends, adherence, and next-step suggestions.</span></span></label>
            </div>
            <div className="mt-3 rounded-xl border border-dashed border-slate-300/80 bg-slate-50/60 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              {profile.medication_reminders_enabled && profile.medications.length > 0
                ? `Medication reminder set for ${profile.medication_reminder_time ?? "08:00"}.`
                : "Medication reminders not configured yet."}{" "}
              {profile.weekly_health_summary_enabled ? "Weekly summary enabled." : "Weekly summary disabled."}
            </div>
          </article>

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Medication name</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. Metformin" value={medicationDraft.name} onChange={(event) => setMedicationDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-1 text-sm"><span>Dosage (optional)</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. 500mg" value={medicationDraft.dosage} onChange={(event) => setMedicationDraft((current) => ({ ...current, dosage: event.target.value }))} /></label>
            <label className="space-y-1 text-sm"><span>Frequency</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={medicationDraft.frequency} onChange={(event) => setMedicationDraft((current) => ({ ...current, frequency: event.target.value as MedicationFrequency }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="as_needed">As needed</option><option value="custom">Custom</option></select></label>
            {medicationDraft.frequency === "custom" ? <label className="space-y-1 text-sm"><span>Custom frequency</span><input className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" placeholder="e.g. Every other day" value={medicationDraft.custom_frequency} onChange={(event) => setMedicationDraft((current) => ({ ...current, custom_frequency: event.target.value }))} /></label> : null}
            <label className="space-y-1 text-sm"><span>Time of day (optional)</span><select className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={medicationDraft.time_of_day} onChange={(event) => setMedicationDraft((current) => ({ ...current, time_of_day: event.target.value as MedicationTimeOfDay | "" }))}><option value="">Not specified</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="bedtime">Bedtime</option></select></label>
            <label className="space-y-1 text-sm md:col-span-2"><span>Notes (optional)</span><textarea className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" rows={2} value={medicationDraft.notes} onChange={(event) => setMedicationDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
          </div>
          <div><button className="rounded-lg border border-brand-300/80 bg-brand-50/90 px-4 py-2 text-sm font-medium text-brand-800 transition hover:-translate-y-0.5 hover:bg-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onClick={onAddMedication}>Add medication</button></div>

          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Active Medications</h3>
          {profile.medications.length > 0 ? <div className="grid min-w-0 gap-3 md:grid-cols-2">{profile.medications.map((medication) => (<article key={medication.id} className="min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/55"><div className="flex items-start justify-between gap-2"><div><h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{medication.name}</h3><p className="text-xs text-slate-500 dark:text-slate-400">{(medication.frequency === "custom" ? medication.custom_frequency : medication.frequency)?.replaceAll("_", " ") || "No frequency"}{medication.time_of_day ? ` • ${medication.time_of_day}` : ""}</p></div><button className="text-xs font-medium text-rose-600 hover:text-rose-500" onClick={() => onRemoveMedication(medication.id)}>Remove</button></div>{medication.dosage ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Dosage: {medication.dosage}</p> : null}{medication.notes ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{medication.notes}</p> : null}</article>))}</div> : <p className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/45 dark:text-slate-300">No medications added yet. Add your first medication above.</p>}
        </section>

        <section className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-slate-100 2xl:mb-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">7. Premium Upgrade Preview</p>
              <h2 className="mt-1 text-xl font-semibold">Unlock deeper coaching automation</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">Your current workspace remains fully usable on free. Premium adds long-range coaching depth without changing your baseline workflow.</p>
            </div>
            <span className="rounded-full border border-amber-200/50 bg-amber-100/10 px-3 py-1 text-xs font-semibold text-amber-200">{isPremium ? "Premium Active" : "Locked on Free"}</span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-600/70 bg-slate-900/60 p-4"><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Included on Free</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">{FREE_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}</ul></article>
            <article className="rounded-xl border border-amber-300/40 bg-amber-100/10 p-4"><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-200">Premium adds</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100">{PREMIUM_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}</ul></article>
          </div>

          <div className="mt-5 flex flex-wrap gap-3"><Link href="/pricing" className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-amber-200">Upgrade to Premium</Link><Link href="/pricing" className="rounded-lg border border-slate-500 bg-transparent px-4 py-2 text-sm font-medium text-slate-100 transition hover:-translate-y-0.5 hover:bg-slate-800">Learn More</Link></div>
        </section>
          </div>

          <aside className="hidden min-w-0 self-start 2xl:block 2xl:sticky 2xl:top-24">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Momentum snapshot</p>
                <p className="mt-2 text-4xl font-semibold text-white">{momentum.score}</p>
                <p className="mt-2 inline-flex rounded-full border border-cyan-500/50 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{momentum.label}</p>
                <div className="mt-3 h-2 rounded-full bg-slate-700">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${momentum.score}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-300">{trendSignal}</p>
              </section>

              <section className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Streaks</p>
                <div className="mt-3 space-y-2 text-sm">
                  {streakHighlights.map((item) => (
                    <div key={`rail-${item.label}`} className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-2">
                      <p className="text-xs font-medium text-slate-200">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Today&apos;s focus</p>
                <p className="mt-2 text-sm text-slate-100">{todaysFocus}</p>
              </section>

              <section className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Quick actions</p>
                <div className="mt-3 grid gap-2">
                  <button type="button" onClick={() => setCheckInOpen(true)} className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-medium text-white">Complete Check-In</button>
                  <button type="button" onClick={jumpToCoach} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100">Ask Coach</button>
                </div>
              </section>

              <section className="rounded-2xl border border-cyan-900/70 bg-cyan-950/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Mini insight</p>
                <p className="mt-2 text-sm text-cyan-100">{miniInsight}</p>
              </section>
            </div>
          </aside>
        </div>
      </section>
    </RequireAuth>
  );
}
