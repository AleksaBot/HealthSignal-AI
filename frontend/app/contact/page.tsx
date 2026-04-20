export default function ContactPage() {
  return (
    <section className="section-shell space-y-5 p-6 md:p-8">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Contact & Support</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">For account access issues, product feedback, or onboarding requests, reach out to our team.</p>
      <article className="premium-card space-y-3 p-5 text-sm text-slate-700 dark:text-slate-300">
        <p><span className="font-semibold">Support email:</span> support@healthsignal.ai</p>
        <p><span className="font-semibold">Response target:</span> Within 1 business day for active customers.</p>
        <p><span className="font-semibold">Medical safety:</span> If this is an emergency, call local emergency services immediately.</p>
      </article>
    </section>
  );
}
