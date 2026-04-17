"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";
import { getUserErrorMessage, saveReport, startSymptomIntake, updateSymptomIntake } from "@/lib/api";
import { FollowUpQuestion, SymptomIntakeSession, SymptomRiskLevel } from "@/lib/types";

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

const RISK_STYLES: Record<SymptomRiskLevel, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  moderate: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300",
  high: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/40 dark:text-orange-300",
  emergency: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300"
};

const ASSISTANT_BUBBLE_BASE_CLASS =
  "max-w-[86%] rounded-2xl rounded-bl-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200";
const ACTIVE_PROMPT_CLASS = `${ASSISTANT_BUBBLE_BASE_CLASS} font-medium ring-1 ring-brand-300/70 dark:ring-brand-400/60`;

function addSymptomText(currentValue: string, symptom: string) {
  const normalized = currentValue.trim();
  const lower = normalized.toLowerCase();
  if (lower.includes(symptom.toLowerCase())) return currentValue;
  if (!normalized) return symptom;
  const endsWithPunctuation = /[.!?]$/.test(normalized);
  return `${normalized}${endsWithPunctuation ? " " : ", "}${symptom}`;
}

function asPercent(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function SymptomAnalyzerPage() {
  const [symptoms, setSymptoms] = useState("");
  const [session, setSession] = useState<SymptomIntakeSession | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<FollowUpQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [triageRecommendation, setTriageRecommendation] = useState<string | null>(null);
  const [summaryPoints, setSummaryPoints] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedReportId, setSavedReportId] = useState<number | null>(null);
  const [summaryFocused, setSummaryFocused] = useState(false);
  const finalSummaryRef = useRef<HTMLElement | null>(null);

  const started = Boolean(session);
  const isComplete = session?.is_complete ?? false;

  const progress = useMemo(() => {
    if (!session) return 0;
    if (session.is_complete || session.current_depth >= session.max_depth) return 100;
    if (session.max_depth <= 0) return 0;
    const stepShare = session.current_depth / session.max_depth;
    return Math.round(Math.max(0, Math.min(1, stepShare)) * 100);
  }, [session]);

  const canStart = symptoms.trim().length >= 3 && !loading;
  const canSubmitAnswer = Boolean(session && activeQuestion && answer.trim().length > 0 && !updating && !isComplete);
  const progressFillWidth = useMemo(() => {
    if (progress <= 0) return "0%";
    if (progress >= 100) return "100%";
    return `max(${asPercent(progress)}, 0.5rem)`;
  }, [progress]);

  async function onStartIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart) return;

    setLoading(true);
    setError(null);
    setSession(null);
    setActiveQuestion(null);
    setAnswer("");
    setTriageRecommendation(null);
    setSummaryPoints([]);
    setCategories([]);

    try {
      const response = await startSymptomIntake({ symptoms: symptoms.trim() });
      setSession(response.session);
      setActiveQuestion(response.answer_plan.follow_up_questions[0] ?? null);
      setTriageRecommendation(response.answer_plan.triage_recommendation);
      setSummaryPoints(response.answer_plan.summary_points);
      setCategories(response.answer_plan.categories);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to start guided intake right now."));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !activeQuestion || !canSubmitAnswer) return;

    setUpdating(true);
    setError(null);

    try {
      const response = await updateSymptomIntake({
        session,
        new_answers: [
          {
            prompt_text: activeQuestion.prompt_text,
            question_category: activeQuestion.question_category,
            answer_text: answer.trim()
          }
        ]
      });

      setSession(response.session);
      setTriageRecommendation(response.answer_plan.triage_recommendation);
      setSummaryPoints(response.answer_plan.summary_points);
      setCategories(response.answer_plan.categories);
      setActiveQuestion(response.answer_plan.follow_up_questions[0] ?? null);
      setAnswer("");
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to submit this follow-up answer right now."));
    } finally {
      setUpdating(false);
    }
  }

  function startNewIntake() {
    setSession(null);
    setActiveQuestion(null);
    setAnswer("");
    setTriageRecommendation(null);
    setSummaryPoints([]);
    setCategories([]);
    setError(null);
    setSaveSuccess(null);
    setSavedReportId(null);
  }

  function viewFinalSummary() {
    const summaryEl = finalSummaryRef.current;
    if (!summaryEl) return;

    const rect = summaryEl.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;

    summaryEl.scrollIntoView({ behavior: "smooth", block: "start" });
    if (isVisible) {
      setSummaryFocused(true);
    }
  }

  useEffect(() => {
    if (!summaryFocused) return;
    const timeout = window.setTimeout(() => setSummaryFocused(false), 1100);
    return () => window.clearTimeout(timeout);
  }, [summaryFocused]);

  async function onSaveReport() {
    if (!session || !isComplete || saving) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const response = await saveReport({
        report_type: "symptom-intake-guided",
        original_input_text: symptoms.trim() || session.input.symptom_text,
        structured_data: {
          extracted: session.extracted,
          categories
        },
        follow_up_qa: session.answers.map((item) => ({ question: item.prompt_text, answer: item.answer_text })),
        outputs: {
          risk_assessment: session.risk_assessment,
          triage_recommendation: triageRecommendation,
          summary_points: summaryPoints,
          completion_reason: session.completion_reason
        }
      });
      setSavedReportId(response.id);
      setSaveSuccess(`Saved report #${response.id} to history.`);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to save this intake report right now."));
    } finally {
      setSaving(false);
    }
  }

  const riskLevel = session?.risk_assessment.risk_level;

  return (
    <RequireAuth>
      <section className="space-y-6">
        <header className="section-shell p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 md:text-3xl">
            Symptom Analyzer
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            A guided intake assistant that captures your symptoms, asks focused follow-up questions, and builds a
            structured triage summary.
          </p>
          <div className="mt-4">
            <DisclaimerBanner />
          </div>
        </header>

        <section className="frosted-panel space-y-4 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Session Progress
            </h2>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{progress}% complete</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-700 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-cyan-500 shadow-[0_0_14px_rgba(14,116,144,0.45)] transition-[width] duration-500 ease-out"
              style={{ width: progressFillWidth }}
              aria-hidden="true"
            />
          </div>
          {session ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Follow-up depth: {session.current_depth}/{session.max_depth}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Start intake to unlock dynamic follow-up questioning.
            </p>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            {!started ? (
              <form
                className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/75"
                onSubmit={onStartIntake}
              >
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Initial Symptom Input
                  </h2>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    Describe what you&apos;re feeling. Include timing, severity, and what changed.
                  </p>
                </div>

                <textarea
                  className="min-h-44 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Example: I have chest tightness, dizziness, and shortness of breath for the last 30 minutes."
                  value={symptoms}
                  onChange={(event) => setSymptoms(event.target.value)}
                  minLength={3}
                  required
                />

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Quick add symptoms
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_SYMPTOMS.map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => setSymptoms((current) => addSymptomText(current, symptom))}
                        className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-300"
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" disabled={!canStart}>
                  {loading ? "Starting guided intake..." : "Start Guided Intake"}
                </button>
              </form>
            ) : (
              <section className="frosted-panel space-y-4 rounded-2xl p-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Guided Follow-up Assistant
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    We ask one focused question at a time to refine your risk and triage recommendation.
                  </p>
                </div>

                <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex justify-start">
                    <div className={`${ASSISTANT_BUBBLE_BASE_CLASS} leading-6`}>
                      Thanks for sharing. I&apos;ll guide your intake and summarize your triage level.
                    </div>
                  </div>

                  {session?.answers.map((item, index) => (
                    <div key={`${item.prompt_text}-${index}`} className="space-y-2">
                      <div className="flex justify-start">
                        <div className={ASSISTANT_BUBBLE_BASE_CLASS}>{item.prompt_text}</div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[86%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-3 text-sm text-white shadow-sm">
                          {item.answer_text}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!isComplete && activeQuestion ? (
                    <div className="flex justify-start">
                      <div className={ACTIVE_PROMPT_CLASS}>{activeQuestion.prompt_text}</div>
                    </div>
                  ) : null}

                  {isComplete ? (
                    <div className="space-y-3 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-brand-50 p-4 dark:border-emerald-500/40 dark:from-emerald-950/40 dark:to-brand-950/30">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                        Guided intake complete. Final structured analysis is ready below.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={onSaveReport}
                          disabled={saving || savedReportId !== null}
                          className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
                        >
                          {savedReportId ? "Report Saved" : saving ? "Saving Report..." : "Save Report"}
                        </button>
                        <Link
                          href="/history"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-300"
                        >
                          View Saved Reports
                        </Link>
                        <button
                          type="button"
                          onClick={startNewIntake}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-300"
                        >
                          Start New Intake
                        </button>
                        <button
                          type="button"
                          onClick={viewFinalSummary}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
                        >
                          View Final Summary
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Save your completed report for future review or start a fresh guided intake.
                      </p>
                      {error ? (
                        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                          {error}
                        </p>
                      ) : null}
                      {saveSuccess ? (
                        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                          {saveSuccess}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {!isComplete && activeQuestion ? (
                  <form onSubmit={onSubmitAnswer} className="space-y-3">
                    <textarea
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      minLength={1}
                      required
                      placeholder="Type your answer to this follow-up question..."
                      className="min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!canSubmitAnswer}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
                      >
                        {updating ? "Submitting..." : "Submit Answer"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            )}

            {error && !isComplete ? (
              <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                {error}
              </p>
            ) : null}
            {saveSuccess && !isComplete ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                {saveSuccess}
              </p>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="premium-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Risk & Triage
              </h2>
              {riskLevel ? (
                <>
                  <p
                    className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${RISK_STYLES[riskLevel]}`}
                  >
                    {riskLevel}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {triageRecommendation}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Risk level appears after the initial symptom analysis.
                </p>
              )}
            </section>

            <section
              ref={finalSummaryRef}
              className={`premium-card p-5 transition-all duration-300 ${
                summaryFocused ? "ring-2 ring-brand-400/80 ring-offset-2 ring-offset-white dark:ring-brand-300/70 dark:ring-offset-slate-900" : ""
              }`}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Structured Summary
              </h2>
              {summaryPoints.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {summaryPoints.map((point) => (
                    <li key={point} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                      {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  We&apos;ll build your extracted signal summary as you complete intake.
                </p>
              )}
            </section>

            <section className="premium-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Likely Categories
              </h2>
              {categories.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Category matching appears after your first analysis pass.
                </p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </RequireAuth>
  );
}
