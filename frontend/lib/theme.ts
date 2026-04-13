export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "healthsignal_theme_preference";

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") {
    return getSystemTheme();
  }

  return preference;
}

export function applyTheme(preference: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }

  const nextTheme = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", nextTheme === "dark");
  root.style.colorScheme = nextTheme;
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
}
