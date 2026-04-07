import { DisclaimerBanner } from "@/components/DisclaimerBanner";

export default function RiskFormPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Risk Form</h1>
      <DisclaimerBanner />
      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded-lg border p-2" placeholder="Age" type="number" />
        <input className="rounded-lg border p-2" placeholder="Systolic BP" type="number" />
        <input className="rounded-lg border p-2" placeholder="Diastolic BP" type="number" />
        <input className="rounded-lg border p-2" placeholder="Fasting glucose" type="number" />
        <input className="rounded-lg border p-2" placeholder="HbA1c (%)" type="number" step="0.1" />
        <input className="rounded-lg border p-2" placeholder="LDL cholesterol" type="number" />
      </div>
      <button className="rounded-lg bg-brand-700 px-4 py-2 text-white">Calculate Risk Insights</button>
    </section>
  );
}
