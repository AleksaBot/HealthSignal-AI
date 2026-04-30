"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { getCoachHistory, getHealthProfile, getRecentCheckIns, getUserErrorMessage, queryCoach } from "@/lib/api";
import { CoachMessage, DailyCheckIn, HealthProfile } from "@/lib/types";

const COACH_PROMPTS = [
  "What should I focus on tomorrow?",
  "Why is my energy low this week?",
  "Help me plan the next 7 days.",
  "How can I improve sleep consistency?",
  "What's my best next habit for momentum?"
];

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

function summarizeWeekly(checkIns: DailyCheckIn[]) {
  if (!checkIns.length) {
    return {
      averageSleep: "No check-ins yet",
      averageEnergy: "No check-ins yet",
      stressPattern: "Not enough stress data yet",
      exerciseSummary: "0 active days tracked",
      completion: "0 of 7 days",
      takeaway: "Start with a quick daily check-in to unlock better weekly coaching guidance."
    };
  }

  const withSleep = checkIns.filter((entry) => typeof entry.sleep_hours === "number");
  const withEnergy = checkIns.filter((entry) => typeof entry.energy_level === "number");
  const stressEntries = checkIns.map((entry) => entry.stress_level).filter(Boolean);
  const exerciseCount = checkIns.filter((entry) => entry.exercised_today).length;
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
    completion: `${checkIns.length} of 7 days`,
    takeaway:
      averageSleepValue < 7 && averageEnergyValue < 7
        ? "Energy dipped on low-sleep days. Sleep consistency is likely the highest-leverage move this week."
        : "Routines are fairly stable; reinforce one repeatable habit to improve momentum."
  };
}

function deriveMomentum(profile: HealthProfile) {
  let score = 50;
  if ((profile.sleep_average_hours ?? 0) >= 7) score += 15;
  if (profile.activity_level === "active" || profile.activity_level === "very_active") score += 15;
  if (profile.stress_level === "low") score += 10;
  if (profile.stress_level === "high" || profile.stress_level === "very_high") score -= 10;

  const bounded = Math.max(20, Math.min(95, score));
  const label = bounded >= 80 ? "Strong Routine" : bounded >= 65 ? "Stable" : bounded >= 50 ? "Building Momentum" : "Needs Attention";

  return {
    score: bounded,
    label,
    explanation:
      bounded >= 65
        ? "Your routine is fairly steady. Keep building with one small, repeatable next step."
        : "Momentum is still building. One consistent daily action can lift weekly stability quickly."
  };
}

export default function CoachPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachMemorySummary, setCoachMemorySummary] = useState<string | null>(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [profile, setProfile] = useState<HealthProfile>(EMPTY_PROFILE);
  const [recentCheckIns, setRecentCheckIns] = useState<DailyCheckIn[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const weeklySummary = useMemo(() => summarizeWeekly(recentCheckIns), [recentCheckIns]);
  const momentum = useMemo(() => deriveMomentum(profile), [profile]);

  const contextPayload = useMemo(
    () => ({
      weeklySummary,
      momentum,
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
    [coachMemorySummary, momentum, recentCheckIns, weeklySummary]
  );

  useEffect(() => {
    async function loadCoachWorkspace() {
      try {
        const [history, healthProfile, checkins] = await Promise.all([getCoachHistory(), getHealthProfile(), getRecentCheckIns(7)]);
        setCoachMessages(history.messages ?? []);
        setCoachMemorySummary(history.memory_summary ?? null);
        setProfile(healthProfile);
        setRecentCheckIns(checkins.items);
      } catch (err) {
        setError(getUserErrorMessage(err, "Unable to load AI Coach workspace."));
      } finally {
        setLoading(false);
      }
    }

    loadCoachWorkspace();
  }, []);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [coachMessages, coachLoading]);

  async function onAskCoach(event?: FormEvent) {
    event?.preventDefault();
    const question = coachQuestion.trim();
    if (!question || coachLoading) return;

    const nextMessages: CoachMessage[] = [...coachMessages, { role: "user", content: question }];
    setCoachMessages(nextMessages);
    setCoachQuestion("");
    setCoachLoading(true);

    try {
      const response = await queryCoach({ question, history: nextMessages, context: contextPayload });
      setCoachMessages((current) => [...current, { role: "coach", content: response.answer }]);
      setCoachMemorySummary(response.memory_summary ?? coachMemorySummary);
    } catch (err) {
      setCoachMessages((current) => [
        ...current,
        { role: "coach", content: getUserErrorMessage(err, "Coach is temporarily unavailable. Please try again shortly.") }
      ]);
    } finally {
      setCoachLoading(false);
    }
  }

  if (loading) {
    return (
      <RequireAuth>
        <section className="section-shell p-8">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading AI Coach workspace...</p>
        </section>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <section className="section-shell mx-auto w-full max-w-4xl space-y-4 px-4 pb-8 pt-6 md:px-6 lg:px-8">
        <header className="space-y-2 border-b border-slate-200/80 pb-5 dark:border-slate-700/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">AI Coach</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">AI Health Coach</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Ask about your habits, check-ins, goals, energy, sleep, and next steps.</p>
        </header>

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</p> : null}

        <article className="premium-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Coach memory status</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{coachMemorySummary ? "Coach memory active • Using saved coaching context" : "Memory begins after your first coach conversation"}</p>
          {coachMemorySummary ? <p className="mt-2 rounded-lg border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">{coachMemorySummary}</p> : null}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Weekly summary: {weeklySummary.takeaway}</p>
        </article>

        <article className="premium-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Chat workspace</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Momentum: {momentum.score}/100 ({momentum.label})</p>
          </div>

          <div ref={messagesContainerRef} className="max-h-[440px] space-y-5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-100/60 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            {coachMessages.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Start a conversation with your coach. Try sleep, stress, goals, or next actions.</p> : null}
            {coachMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`max-w-full break-words rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${message.role === "user" ? "ml-auto w-full bg-brand-700/90 text-white md:w-[80%] lg:w-[72%]" : "mr-auto w-full border border-cyan-200/70 bg-cyan-50/70 text-slate-800 dark:border-cyan-900/50 dark:bg-cyan-950/25 dark:text-slate-100 md:w-[88%] lg:w-[82%]"}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{message.role === "user" ? "You" : "Coach"}</p>
                <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            {coachLoading ? <p className="text-xs text-slate-500 dark:text-slate-400">Coach is thinking...</p> : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {COACH_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setCoachQuestion(prompt)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form onSubmit={onAskCoach} className="mt-5 grid gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-700/70 md:grid-cols-[1fr_auto]">
            <input
              value={coachQuestion}
              onChange={(event) => setCoachQuestion(event.target.value)}
              placeholder="Ask your AI health coach..."
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
            <button type="submit" disabled={coachLoading} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {coachLoading ? "Thinking..." : "Ask Coach"}
            </button>
          </form>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Educational only. Not medical diagnosis or emergency guidance. For urgent symptoms, seek immediate care.</p>
        </article>

        <div className="flex justify-end">
          <Link href="/profile" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Back to My Health</Link>
        </div>
      </section>
    </RequireAuth>
  );
}
