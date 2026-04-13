"use client";

import { ThemePreference } from "@/lib/theme";

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

export function ThemeSelector({
  value,
  onChange,
  compact = false
}: {
  value: ThemePreference;
  onChange: (next: ThemePreference) => void;
  compact?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 dark:border-slate-700 dark:bg-slate-900/90 ${compact ? "w-full" : ""}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              selected
                ? "bg-brand-700 text-white shadow-sm shadow-brand-700/30"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
