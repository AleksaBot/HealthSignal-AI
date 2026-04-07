import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const cards = [
  {
    title: "Symptom Analyzer",
    description: "Enter symptoms in plain English to extract clinical signals and highlight potential red flags.",
    href: "/symptom-analyzer"
  },
  {
    title: "Note Interpreter",
    description: "Paste visit summaries or clinician notes and get structured interpretation and explainable insights.",
    href: "/note-interpreter"
  },
  {
    title: "Risk Form",
    description: "Submit structured health data to generate stroke, diabetes, and cardiovascular risk insights.",
    href: "/risk-form"
  }
];

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">HealthSignal AI</h1>
        <p className="max-w-2xl text-slate-600">
          A health intelligence workspace for educational decision support, signal extraction, and risk insights.
        </p>
      </div>
      <DisclaimerBanner />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-brand-700">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
