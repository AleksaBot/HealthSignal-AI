import { DisclaimerBanner } from "@/components/DisclaimerBanner";

export default function HistoryPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Saved Reports</h1>
      <DisclaimerBanner />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No reports yet. Generated analyses will appear here with timestamps and report type.
      </div>
    </section>
  );
}
