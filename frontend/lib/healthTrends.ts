import { HealthProfile, ReportRead } from "@/lib/types";

type ActivityLevel = HealthProfile["activity_level"];
type StressLevel = HealthProfile["stress_level"];

type SnapshotPoint = {
  timestamp: string;
  profile: HealthProfile;
};

export type TrendCard = {
  label: string;
  value: string;
  detail: string;
};

export type TimelineItem = {
  id: string;
  type: "profile_snapshot" | "symptom_report" | "note_report" | "other_report";
  title: string;
  detail: string;
  timestamp: string;
};

export type HealthTrendsSummary = {
  hasHistory: boolean;
  trendCards: TrendCard[];
  timeline: TimelineItem[];
  patternInsights: string[];
  reportsLast30Days: number;
  snapshotsThisMonth: number;
};

function parseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDelta(next: number | null, prev: number | null, unit = "") {
  if (next === null || prev === null) return "Not enough data";
  const delta = Number((next - prev).toFixed(1));
  if (delta === 0) return `Stable ${unit}`.trim();
  const direction = delta > 0 ? "up" : "down";
  return `${Math.abs(delta)}${unit} ${direction}`;
}

function activityScore(value: ActivityLevel) {
  const map: Record<Exclude<ActivityLevel, null>, number> = {
    low: 1,
    moderate: 2,
    active: 3,
    very_active: 4
  };
  return value ? map[value] : null;
}

function stressScore(value: StressLevel) {
  const map: Record<Exclude<StressLevel, null>, number> = {
    low: 1,
    moderate: 2,
    high: 3,
    very_high: 4
  };
  return value ? map[value] : null;
}

function reportTypeLabel(reportType: string) {
  if (reportType === "health-profile-risk-insights-v1") return "Profile insight snapshot";
  if (reportType === "symptom-intake-guided") return "Symptom analyzer report";
  if (reportType.startsWith("note-interpreter")) return "Note interpreter report";
  return "Saved report";
}

function getProfileSnapshots(reports: ReportRead[]) {
  const points: SnapshotPoint[] = [];

  for (const report of reports) {
    if (report.report_type !== "health-profile-risk-insights-v1") continue;

    const parsedOutput = parseJson(report.output_summary);
    const structuredData = asObject(parsedOutput?.structured_data);
    const profileSnapshot = asObject(structuredData?.profile_snapshot);
    if (!profileSnapshot) continue;

    const timestamp = typeof report.created_at === "string" ? report.created_at : "";
    points.push({
      timestamp,
      profile: {
        age: (profileSnapshot.age as number | null) ?? null,
        sex: (profileSnapshot.sex as HealthProfile["sex"]) ?? null,
        height_cm: (profileSnapshot.height_cm as number | null) ?? null,
        weight_kg: (profileSnapshot.weight_kg as number | null) ?? null,
        activity_level: (profileSnapshot.activity_level as ActivityLevel) ?? null,
        smoking_vaping_status: (profileSnapshot.smoking_vaping_status as HealthProfile["smoking_vaping_status"]) ?? null,
        alcohol_frequency: (profileSnapshot.alcohol_frequency as HealthProfile["alcohol_frequency"]) ?? null,
        sleep_average_hours: (profileSnapshot.sleep_average_hours as number | null) ?? null,
        stress_level: (profileSnapshot.stress_level as StressLevel) ?? null,
        known_conditions: Array.isArray(profileSnapshot.known_conditions) ? (profileSnapshot.known_conditions as string[]) : [],
        current_medications: Array.isArray(profileSnapshot.current_medications) ? (profileSnapshot.current_medications as string[]) : [],
        medications: Array.isArray(profileSnapshot.medications) ? (profileSnapshot.medications as HealthProfile["medications"]) : [],
        family_history: Array.isArray(profileSnapshot.family_history) ? (profileSnapshot.family_history as string[]) : [],
        systolic_bp: (profileSnapshot.systolic_bp as number | null) ?? null,
        diastolic_bp: (profileSnapshot.diastolic_bp as number | null) ?? null,
        total_cholesterol: (profileSnapshot.total_cholesterol as number | null) ?? null,
        updated_at: (profileSnapshot.updated_at as string | null) ?? null
      }
    });
  }

  return points.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function buildHealthTrendsSummary(profile: HealthProfile | null, reports: ReportRead[]): HealthTrendsSummary {
  const now = new Date();
  const reportsLast30Days = reports.filter((report) => {
    const date = toDate(report.created_at);
    return date ? daysBetween(now, date) <= 30 : false;
  }).length;

  const snapshots = getProfileSnapshots(reports);
  const newestSnapshot = snapshots[0]?.profile ?? null;
  const oldestSnapshot = snapshots[snapshots.length - 1]?.profile ?? null;

  const latestProfile = profile ?? newestSnapshot;
  const hasHistory = Boolean(reports.length || profile?.updated_at);

  const snapshotsThisMonth = snapshots.filter((point) => {
    const date = toDate(point.timestamp);
    return date ? date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() : false;
  }).length;

  const trendCards: TrendCard[] = [
    {
      label: "Weight trend",
      value: latestProfile?.weight_kg ? `${latestProfile.weight_kg} kg` : "No recent data",
      detail: formatDelta(newestSnapshot?.weight_kg ?? null, oldestSnapshot?.weight_kg ?? null, " kg")
    },
    {
      label: "Sleep trend",
      value: latestProfile?.sleep_average_hours ? `${latestProfile.sleep_average_hours} hrs` : "No recent data",
      detail: formatDelta(newestSnapshot?.sleep_average_hours ?? null, oldestSnapshot?.sleep_average_hours ?? null, " hrs")
    },
    {
      label: "Stress trend",
      value: latestProfile?.stress_level ? latestProfile.stress_level.replace("_", " ") : "No recent data",
      detail: formatDelta(stressScore(newestSnapshot?.stress_level ?? null), stressScore(oldestSnapshot?.stress_level ?? null))
    },
    {
      label: "Activity consistency",
      value: latestProfile?.activity_level ? latestProfile.activity_level.replace("_", " ") : "No recent data",
      detail: formatDelta(activityScore(newestSnapshot?.activity_level ?? null), activityScore(oldestSnapshot?.activity_level ?? null))
    },
    {
      label: "Saved insight cadence",
      value: `${snapshots.length} total snapshots`,
      detail: `${snapshotsThisMonth} saved this month`
    },
    {
      label: "Reports (30 days)",
      value: `${reportsLast30Days}`,
      detail: reportsLast30Days > 0 ? "Active monitoring period" : "No recent report activity"
    }
  ];

  const recentTimeline: TimelineItem[] = reports
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((report) => {
      let type: TimelineItem["type"] = "other_report";
      if (report.report_type === "health-profile-risk-insights-v1") type = "profile_snapshot";
      else if (report.report_type === "symptom-intake-guided") type = "symptom_report";
      else if (report.report_type.startsWith("note-interpreter")) type = "note_report";

      return {
        id: `${report.id}`,
        type,
        title: reportTypeLabel(report.report_type),
        detail: `Report #${report.id}`,
        timestamp: report.created_at
      };
    });

  const recentTypeCounts = reportsLast30Days
    ? reports
        .filter((report) => {
          const date = toDate(report.created_at);
          return date ? daysBetween(now, date) <= 30 : false;
        })
        .reduce<Record<string, number>>((acc, report) => {
          acc[report.report_type] = (acc[report.report_type] ?? 0) + 1;
          return acc;
        }, {})
    : {};

  const dominantType = Object.entries(recentTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const patternInsights: string[] = [];
  if (snapshotsThisMonth > 0) patternInsights.push(`You have saved ${snapshotsThisMonth} health snapshot${snapshotsThisMonth > 1 ? "s" : ""} this month.`);
  if (latestProfile?.updated_at) {
    const lastUpdated = toDate(latestProfile.updated_at);
    if (lastUpdated) {
      const days = daysBetween(now, lastUpdated);
      if (days <= 14) patternInsights.push("Your profile baseline has been updated recently.");
      else patternInsights.push("Your profile baseline has not been refreshed recently.");
    }
  }

  const sleepDelta = formatDelta(newestSnapshot?.sleep_average_hours ?? null, oldestSnapshot?.sleep_average_hours ?? null, " hrs");
  if (sleepDelta.toLowerCase().startsWith("stable")) patternInsights.push("Recent profile snapshots suggest stable sleep habits.");

  if (dominantType === "symptom-intake-guided") patternInsights.push("Most recent reports were symptom-analyzer related.");
  if (dominantType?.startsWith("note-interpreter")) patternInsights.push("Most recent reports were clinician-note interpretations.");

  if (!patternInsights.length) {
    patternInsights.push("No strong longitudinal pattern yet. Save more snapshots to unlock deeper trend signals.");
  }

  return {
    hasHistory,
    trendCards,
    timeline: recentTimeline,
    patternInsights,
    reportsLast30Days,
    snapshotsThisMonth
  };
}
