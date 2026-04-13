import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";

const quickActions = [
  {
    title: "Symptom Analyzer",
    description: "Analyze free-text symptom descriptions and capture structured clinical signals.",
    href: "/symptom-analyzer"
  },
  {
    title: "Note Interpreter",
    description: "Convert clinician notes into organized findings and contextual summaries.",
    href: "/note-interpreter"
  },
  {
    title: "Risk Form",
    description: "Run focused risk estimation workflows from structured health measurements.",
    href: "/risk-form"
  },
  {
    title: "Report History",
    description: "Review previous analyses and continue ongoing longitudinal workflows.",
    href: "/history"
  }
] as const;

const statCards = [
  { label: "Active Workflows", value: "3", context: "Analyzer, Notes, Risk" },
  { label: "Shortcuts", value: "4", context: "Operational modules" },
  { label: "Workspace Mode", value: "Operational", context: "Control panel enabled" }
] as const;

export default function DashboardPage() {
  return (
    <RequireAuth>
      <section className="relative isolate space-y-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 px-6 py-7 shadow-2xl shadow-slate-300/30 backdrop-blur-sm md:px-8">
        <div className="pointer-events-none absolute -top-20 right-0 h-52 w-52 rounded-full bg-brand-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-8 h-56 w-56 rounded-full bg-cyan-200/25 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Operations Dashboard</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clinical workflow control panel</h1>
            <p className="text-sm text-slate-600">Monitor active modules, jump into workflows, and keep report production moving.</p>
          </div>
          <Link
            href="/history"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            Open Report Queue
          </Link>
        </div>

        <div className="relative grid gap-4 md:grid-cols-3">
          {statCards.map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-200/85 bg-white/90 p-4 shadow-md shadow-slate-200/60 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/50"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.context}</p>
            </article>
          ))}
        </div>

        <div className="relative grid gap-4 md:grid-cols-2">
          {quickActions.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-slate-200/85 bg-white/95 p-5 shadow-md shadow-slate-200/60 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-100/50"
            >
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              <p className="mt-4 text-sm font-medium text-brand-700 transition group-hover:translate-x-1">Open workflow →</p>
            </Link>
          ))}
        </div>

        <DisclaimerBanner compact />
      </section>
    </RequireAuth>
  );
}
