import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const stats = [
  ["Reports Generated", "0"],
  ["Red Flags Detected", "0"],
  ["Active Monitoring Profiles", "0"]
] as const;

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <DisclaimerBanner />
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-brand-700">{value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
