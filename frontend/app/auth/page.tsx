export default function AuthPage() {
  return (
    <section className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-sm text-slate-600">Starter authentication screen for account access and report history.</p>
      <form className="space-y-3">
        <input className="w-full rounded-lg border p-2" placeholder="Email" type="email" />
        <input className="w-full rounded-lg border p-2" placeholder="Password" type="password" />
        <button className="rounded-lg bg-brand-700 px-4 py-2 text-white" type="submit">
          Continue
        </button>
      </form>
    </section>
  );
}
