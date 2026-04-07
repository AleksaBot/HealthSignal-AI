import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";

const stats = [
  ["Reports Generated", "Use History to view reports"],
  ["Red Flags Detected", "Generated per analysis"],
  ["Active Monitoring Profiles", "MVP placeholder"]
] as const;

export default function DashboardPage() {
  return (
    <RequireAuth>
      <section className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <DisclaimerBanner />
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map(([label, value]) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-base font-semibold text-brand-700">{value}</p>
            </article>
          ))}
        </div>
      </section>
    </RequireAuth>
  );
}
