import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For individuals starting their health tracking workflow.",
    features: [
      "Dashboard + My Health profile",
      "Basic symptom and note workflows",
      "Standard report history",
      "Manual medication logging"
    ],
    cta: "Start Free",
    highlight: false
  },
  {
    name: "Pro",
    price: "$19/mo",
    description: "For members who want deeper AI interpretation and premium productivity.",
    features: [
      "Advanced AI plain-English summaries",
      "Premium report export formats (coming soon)",
      "Medication adherence interpretation",
      "Priority trend analytics and insights",
      "Weekly AI health summary digest"
    ],
    cta: "Upgrade to Pro",
    highlight: true
  },
  {
    name: "Family",
    price: "$39/mo",
    description: "For households managing shared prevention and adherence routines.",
    features: [
      "Everything in Pro",
      "Multi-person profile views (planned)",
      "Clinician-ready summary templates",
      "Family medication reminder preferences",
      "Shared support and onboarding"
    ],
    cta: "Choose Family",
    highlight: false
  }
] as const;

export default function PricingPage() {
  return (
    <section className="section-shell mx-auto w-full max-w-[1040px] space-y-6 overflow-x-clip p-5 md:p-7">
      <div className="space-y-3 border-b border-slate-200/80 pb-5 dark:border-slate-700/70">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Pricing</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Premium plans for a smarter health workflow</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          HealthSignal AI plans are designed for educational guidance, adherence support, and clearer preparation before clinician follow-ups.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`premium-card min-w-0 flex h-full flex-col p-5 ${
              plan.highlight ? "border-brand-400/60 shadow-brand-500/20 dark:border-brand-400/50" : ""
            }`}
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{plan.name}</p>
              <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{plan.price}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>
            </div>
            <ul className="mt-5 flex-1 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button
              type="button"
              className={`mt-6 rounded-lg px-4 py-2 text-sm font-medium transition ${
                plan.highlight
                  ? "bg-brand-700 text-white shadow-md shadow-brand-700/30 hover:-translate-y-0.5 hover:bg-brand-600"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              }`}
            >
              {plan.cta}
            </button>
          </article>
        ))}
      </div>

      <article className="premium-card space-y-3 p-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Billing and activation</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Billing integration is not yet enabled in this sprint. Upgrade actions currently prepare the product surface for future secure checkout.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Need enterprise onboarding or clinician group rollout? <Link href="/contact" className="font-medium text-brand-700 dark:text-brand-300">Contact support</Link>.
        </p>
      </article>
    </section>
  );
}
