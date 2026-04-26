import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "HealthSignal AI",
  description: "Educational health intelligence and risk insight platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen w-full max-w-full overflow-x-hidden">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
