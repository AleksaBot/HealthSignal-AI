import { DisclaimerBanner } from "@/components/DisclaimerBanner";

export default function NoteInterpreterPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Note Interpreter</h1>
      <DisclaimerBanner />
      <p className="text-sm text-slate-600">Paste doctor notes or visit summaries for structured clinical signal extraction.</p>
      <textarea className="min-h-52 w-full rounded-xl border border-slate-300 bg-white p-3" placeholder="Paste note text" />
      <button className="rounded-lg bg-brand-700 px-4 py-2 text-white">Interpret Note</button>
    </section>
  );
}
