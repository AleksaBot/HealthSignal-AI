import { DisclaimerBanner } from "@/components/DisclaimerBanner";

export default function SymptomAnalyzerPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Symptom Analyzer</h1>
      <DisclaimerBanner />
      <p className="text-sm text-slate-600">Describe symptoms in plain English for structured extraction and risk cues.</p>
      <textarea
        className="min-h-40 w-full rounded-xl border border-slate-300 bg-white p-3"
        placeholder="Example: I've had chest tightness, shortness of breath, and dizziness for two days..."
      />
      <button className="rounded-lg bg-brand-700 px-4 py-2 text-white">Analyze Symptoms</button>
    </section>
  );
}
