type DisclaimerBannerProps = {
  compact?: boolean;
};

export function DisclaimerBanner({ compact = false }: DisclaimerBannerProps) {
  return (
    <div
      className={`rounded-xl border border-amber-200/80 bg-amber-50/75 text-amber-900 shadow-sm shadow-amber-100/40 dark:border-amber-300/30 dark:bg-slate-900/85 dark:text-amber-100 ${compact ? "p-3 text-xs" : "p-4 text-sm"}`}
    >
      <p className="font-semibold tracking-wide text-amber-900 dark:text-amber-100">Medical Disclaimer</p>
      <p className="mt-1 leading-relaxed text-amber-800 dark:text-amber-50/90">
        HealthSignal AI provides educational decision support and risk insights only. It does not diagnose, treat, or replace licensed
        medical professionals. If you have urgent symptoms, seek emergency care.
      </p>
    </div>
  );
}
