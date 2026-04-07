import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  ["Dashboard", "/dashboard"],
  ["Symptom Analyzer", "/symptom-analyzer"],
  ["Note Interpreter", "/note-interpreter"],
  ["Risk Form", "/risk-form"],
  ["Report History", "/history"],
  ["Auth", "/auth"]
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-brand-700">
            HealthSignal AI
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item[1]} href={item[1]} className="text-slate-700 hover:text-brand-700">
                {item[0]}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">{children}</main>
    </div>
  );
}
