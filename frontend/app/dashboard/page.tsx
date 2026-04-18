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
    title: "Health Profile + Risk Insights",
    description: "Save your baseline profile and generate practical educational risk insights.",
    href: "/profile"
  },
  {
    title: "Report History",
    description: "Review previous analyses and continue ongoing longitudinal workflows.",
    href: "/history"
  }
] as const;

const statCards = [
  { label: "Active Workflows", value: "3", context: "Analyzer, Notes, Profile Insights" },
  { label: "Shortcuts", value: "4", context: "Operational modules" },
  { label: "Workspace Mode", value: "Operational", context: "Control panel enabled" }
] as const;

export default function DashboardPage() {
  return (
    <RequireAuth>
      <section className="section-shell space-y-6 px-6 py-7 md:px-8">
        <div className="ambient-orb -top-20 right-0 h-52 w-52 bg-brand-300/20" />
        <div className="ambient-orb -left-20 bottom-8 h-56 w-56 bg-cyan-200/25" />

        <div className="relative flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-700/70">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Operations Dashboard</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Clinical workflow control panel</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Monitor active modules, jump into workflows, and keep report production moving.</p>
          </div>
          <Link
            href="/history"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200"
          >
            Open Report Queue
          </Link>
        </div>

        <div className="relative grid gap-4 md:grid-cols-3">
          {statCards.map((card, index) => (
            <article
              key={card.label}
              style={{ animationDelay: `${index * 50}ms` }}
              className="premium-card premium-card-interactive animate-fade-up p-4"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.context}</p>
            </article>
          ))}
        </div>

        <div className="relative grid gap-4 md:grid-cols-2">
          {quickActions.map((item, index) => (
            <Link
              key={item.title}
              href={item.href}
              style={{ animationDelay: `${120 + index * 60}ms` }}
              className="premium-card premium-card-interactive animate-fade-up group p-5"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
              <p className="mt-4 text-sm font-medium text-brand-700 transition group-hover:translate-x-1 dark:text-brand-300">Open workflow →</p>
            </Link>
          ))}
        </div>

        <DisclaimerBanner compact />
      </section>
    </RequireAuth>
  );
}
