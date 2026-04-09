import { AnalysisResponse } from "@/lib/types";

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">No items returned.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AnalysisResultCard({ result }: { result: AnalysisResponse }) {
  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Analysis Results</h2>
      <SectionList title="Extracted Signals" items={result.extracted_signals} />
      <SectionList title="Red Flags" items={result.red_flags} />
      <SectionList title="Likely Categories" items={result.likely_categories} />
      <section>
        <h3 className="text-sm font-semibold text-slate-900">Risk Insights</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(result.risk_insights).map(([label, insight]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{insight}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Reasoning</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">{result.reasoning}</p>
      </section>
    </article>
  );
}
