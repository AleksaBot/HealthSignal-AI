import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";

const quickActions = [
  {
    title: "Symptom Analyzer",
    description: "Analyze free-text symptom descriptions and extract key clinical signals.",
    href: "/symptom-analyzer"
  },
  {
    title: "Note Interpreter",
    description: "Interpret clinician notes with structured output you can quickly review.",
    href: "/note-interpreter"
  },
  {
    title: "Risk Form",
    description: "Run targeted risk insights from structured patient measurements.",
    href: "/risk-form"
  },
  {
    title: "Report History",
    description: "Review and revisit prior analyses and saved summaries.",
    href: "/history"
  }
] as const;

export default function DashboardPage() {
  return (
    <RequireAuth>
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-600">Choose an analysis workflow or review your previous reports.</p>
        </div>
        <DisclaimerBanner />
        <div className="grid gap-4 md:grid-cols-2">
          {quickActions.map((item) => (
            <Link key={item.title} href={item.href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow">
              <h2 className="text-lg font-semibold text-brand-700">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </RequireAuth>
  );
}
