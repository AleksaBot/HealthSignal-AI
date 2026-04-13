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
      <section className="space-y-6 rounded-3xl border border-slate-200 bg-slate-950 px-6 py-7 text-slate-100 shadow-2xl shadow-slate-400/25 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Operations Dashboard</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Clinical workflow control panel</h1>
            <p className="text-sm text-slate-400">Monitor active modules, jump into workflows, and keep report production moving.</p>
          </div>
          <Link
            href="/history"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-cyan-200"
          >
            Open Report Queue
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {statCards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-cyan-400/70">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
              <p className="mt-1 text-xs text-slate-400">{card.context}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {quickActions.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-slate-800 bg-slate-900/90 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{item.description}</p>
              <p className="mt-4 text-sm font-medium text-cyan-300 transition group-hover:translate-x-1">Open workflow →</p>
            </Link>
          ))}
        </div>

        <DisclaimerBanner compact />
      </section>
    </RequireAuth>
  );
}
